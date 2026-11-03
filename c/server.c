/*
 * ============================================================================
 * FILE        : c/server.c
 * PROJECT     : Smart Temperature Analyzer & Converter with Intelligent Alerts
 * DESCRIPTION : Lightweight C HTTP + JSON API Server that exposes all core C
 *               functions from c/temperature.c over REST endpoints and serves
 *               the static frontend at http://localhost:8080.
 * ============================================================================
 */

#ifdef _WIN32
#define _CRT_SECURE_NO_WARNINGS
#include <winsock2.h>
#include <ws2tcpip.h>
typedef int socklen_t;
#define close_socket closesocket
#else
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
typedef int SOCKET;
#define INVALID_SOCKET (-1)
#define SOCKET_ERROR   (-1)
#define close_socket close
#endif

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <ctype.h>
#include "temperature.h"

#define DEFAULT_PORT 8080
#define BUFFER_SIZE  65536
#define MAX_READINGS 512

/* Helper: extract query parameter from URL query string */
static int get_query_param(const char *query, const char *key, char *out, size_t out_size) {
    if (!query || !key || !out || out_size == 0) return 0;
    size_t key_len = strlen(key);
    const char *p = query;

    while (*p) {
        if (strncmp(p, key, key_len) == 0 && p[key_len] == '=') {
            p += key_len + 1;
            size_t i = 0;
            while (*p && *p != '&' && *p != ' ' && *p != '\r' && *p != '\n' && i + 1 < out_size) {
                if (*p == '%' && isxdigit((unsigned char)p[1]) && isxdigit((unsigned char)p[2])) {
                    char hex[3] = { p[1], p[2], '\0' };
                    out[i++] = (char)strtol(hex, NULL, 16);
                    p += 3;
                } else if (*p == '+') {
                    out[i++] = ' ';
                    p++;
                } else {
                    out[i++] = *p++;
                }
            }
            out[i] = '\0';
            return 1;
        }
        while (*p && *p != '&') p++;
        if (*p == '&') p++;
    }
    return 0;
}

/* Helper: send HTTP response */
static void send_http_response(SOCKET client, int status_code, const char *status_text,
                               const char *content_type, const char *body, size_t body_len) {
    char header[1024];
    int header_len = snprintf(
        header, sizeof(header),
        "HTTP/1.1 %d %s\r\n"
        "Content-Type: %s\r\n"
        "Content-Length: %zu\r\n"
        "Access-Control-Allow-Origin: *\r\n"
        "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
        "Access-Control-Allow-Headers: Content-Type\r\n"
        "Cache-Control: no-cache\r\n"
        "Connection: close\r\n\r\n",
        status_code, status_text, content_type, body_len
    );
    send(client, header, header_len, 0);
    if (body && body_len > 0) {
        send(client, body, (int)body_len, 0);
    }
}

/* Helper: serve a static file from disk */
static void serve_static_file(SOCKET client, const char *filepath, const char *content_type) {
    FILE *fp = fopen(filepath, "rb");
    if (!fp) {
        const char *not_found = "{\"error\":\"File not found\"}";
        send_http_response(client, 404, "Not Found", "application/json", not_found, strlen(not_found));
        return;
    }
    fseek(fp, 0, SEEK_END);
    long fsize = ftell(fp);
    fseek(fp, 0, SEEK_SET);

    if (fsize < 0) {
        fclose(fp);
        const char *err = "{\"error\":\"Failed to read file\"}";
        send_http_response(client, 500, "Internal Server Error", "application/json", err, strlen(err));
        return;
    }

    char *content = (char *)malloc((size_t)fsize + 1);
    if (!content) {
        fclose(fp);
        return;
    }
    size_t read_bytes = fread(content, 1, (size_t)fsize, fp);
    fclose(fp);

    send_http_response(client, 200, "OK", content_type, content, read_bytes);
    free(content);
}

/* API Endpoint: GET /api/convert?value=25&from=C&to=F */
static void handle_api_convert(SOCKET client, const char *query) {
    char val_str[64]  = "";
    char from_str[16] = "C";
    char to_str[16]   = "F";

    if (!get_query_param(query, "value", val_str, sizeof(val_str)) || val_str[0] == '\0') {
        const char *msg = "{\"valid\":false,\"errorHeadline\":\"INVALID INPUT!\",\"errorMessage\":\"Temperature input cannot be empty.\"}";
        send_http_response(client, 400, "Bad Request", "application/json; charset=utf-8", msg, strlen(msg));
        return;
    }

    get_query_param(query, "from", from_str, sizeof(from_str));
    get_query_param(query, "to", to_str, sizeof(to_str));

    char *endptr = NULL;
    double value = strtod(val_str, &endptr);
    while (endptr && *endptr && isspace((unsigned char)*endptr)) endptr++;
    if (endptr == val_str || (endptr && *endptr != '\0')) {
        const char *msg = "{\"valid\":false,\"errorHeadline\":\"INVALID TEMPERATURE!\",\"errorMessage\":\"Non-numeric input is not allowed.\"}";
        send_http_response(client, 400, "Bad Request", "application/json; charset=utf-8", msg, strlen(msg));
        return;
    }

    int from_unit = temp_unit_from_char(from_str[0]);
    int to_unit   = temp_unit_from_char(to_str[0]);
    if (from_unit < 0) from_unit = UNIT_CELSIUS;
    if (to_unit < 0)   to_unit   = UNIT_FAHRENHEIT;

    TempConversionResult conv;
    if (!temp_convert_all(value, from_unit, &conv)) {
        char err_json[512];
        snprintf(
            err_json, sizeof(err_json),
            "{"
            "\"valid\":false,"
            "\"errorHeadline\":\"INVALID TEMPERATURE!\","
            "\"errorMessage\":\"Temperature cannot be below absolute zero.\","
            "\"errorDetail\":\"%s\","
            "\"absZero\":%.2f,"
            "\"unitSymbol\":\"%s\""
            "}",
            conv.error_message,
            temp_get_abs_zero(from_unit),
            temp_unit_symbol(from_unit)
        );
        send_http_response(client, 200, "OK", "application/json; charset=utf-8", err_json, strlen(err_json));
        return;
    }

    double pair_result = temp_convert_pair(value, from_unit, to_unit);
    const char *formula = temp_get_formula(from_unit, to_unit);
    char step_formula[256] = "";
    temp_get_step_formula(value, from_unit, to_unit, step_formula, sizeof(step_formula));

    TempReadingClassification cls;
    temp_classify_celsius(conv.celsius, &cls);

    char json[2048];
    snprintf(
        json, sizeof(json),
        "{"
        "\"valid\":true,"
        "\"engine\":\"C-Native (/c/temperature.c)\","
        "\"inputValue\":%.4f,"
        "\"fromUnit\":\"%c\","
        "\"toUnit\":\"%c\","
        "\"pairResult\":%.4f,"
        "\"formula\":\"%s\","
        "\"stepFormula\":\"%s\","
        "\"celsius\":%.4f,"
        "\"fahrenheit\":%.4f,"
        "\"kelvin\":%.4f,"
        "\"rankine\":%.4f,"
        "\"alert\":{"
          "\"code\":%d,"
          "\"category\":\"%s\","
          "\"badge\":\"%s\","
          "\"message\":\"%s\","
          "\"recommendation\":\"%s\","
          "\"color\":\"%s\","
          "\"displayTheme\":\"%s\""
        "}"
        "}",
        value,
        (char)toupper((unsigned char)from_str[0]),
        (char)toupper((unsigned char)to_str[0]),
        pair_result,
        formula,
        step_formula,
        conv.celsius,
        conv.fahrenheit,
        conv.kelvin,
        conv.rankine,
        cls.code,
        cls.category,
        cls.badge,
        cls.message,
        cls.recommendation,
        cls.color_hex,
        cls.display_theme
    );

    send_http_response(client, 200, "OK", "application/json; charset=utf-8", json, strlen(json));
}

/* API Endpoint: GET /api/analyze?unit=C&values=12.5,18,22.4,28,36,48 */
static void handle_api_analyze(SOCKET client, const char *query) {
    char unit_str[16] = "C";
    char values_str[8192] = "";

    get_query_param(query, "unit", unit_str, sizeof(unit_str));
    if (!get_query_param(query, "values", values_str, sizeof(values_str)) || values_str[0] == '\0') {
        const char *msg = "{\"valid\":false,\"error\":\"Please provide comma-separated temperature readings.\"}";
        send_http_response(client, 400, "Bad Request", "application/json; charset=utf-8", msg, strlen(msg));
        return;
    }

    int unit = temp_unit_from_char(unit_str[0]);
    if (unit < 0) unit = UNIT_CELSIUS;

    double values[MAX_READINGS];
    int count = 0;

    char *copy = (char *)malloc(strlen(values_str) + 1);
    if (!copy) return;
    strcpy(copy, values_str);

    char *token = strtok(copy, ",; \t\r\n");
    while (token != NULL && count < MAX_READINGS) {
        char *endptr = NULL;
        double v = strtod(token, &endptr);
        if (endptr == token || (endptr && *endptr != '\0')) {
            char err_buf[256];
            snprintf(err_buf, sizeof(err_buf),
                     "{\"valid\":false,\"error\":\"Invalid non-numeric reading '%s' at position %d.\"}",
                     token, count + 1);
            free(copy);
            send_http_response(client, 200, "OK", "application/json; charset=utf-8", err_buf, strlen(err_buf));
            return;
        }
        if (!temp_validate(v, unit)) {
            char err_buf[256];
            snprintf(err_buf, sizeof(err_buf),
                     "{\"valid\":false,\"error\":\"Reading #%.0d (%.2f %s) is below Absolute Zero (%.2f %s)!\"}",
                     count + 1, v, temp_unit_symbol(unit), temp_get_abs_zero(unit), temp_unit_symbol(unit));
            free(copy);
            send_http_response(client, 200, "OK", "application/json; charset=utf-8", err_buf, strlen(err_buf));
            return;
        }
        values[count++] = v;
        token = strtok(NULL, ",; \t\r\n");
    }
    free(copy);

    if (count == 0) {
        const char *msg = "{\"valid\":false,\"error\":\"No valid numeric readings found.\"}";
        send_http_response(client, 200, "OK", "application/json; charset=utf-8", msg, strlen(msg));
        return;
    }

    TempStatsResult stats;
    if (!temp_analyze_array(values, count, unit, &stats)) {
        const char *msg = "{\"valid\":false,\"error\":\"C statistical analysis failed due to invalid input.\"}";
        send_http_response(client, 200, "OK", "application/json; charset=utf-8", msg, strlen(msg));
        return;
    }

    /* Build JSON response containing stats + per-reading C classifications */
    size_t cap = 65536;
    char *json = (char *)malloc(cap);
    if (!json) return;

    int offset = snprintf(
        json, cap,
        "{"
        "\"valid\":true,"
        "\"engine\":\"C-Native (/c/temperature.c)\","
        "\"count\":%d,"
        "\"inputUnit\":\"%c\","
        "\"unitSymbol\":\"%s\","
        "\"stats\":{"
          "\"min\":%.4f,\"max\":%.4f,\"average\":%.4f,\"median\":%.4f,\"range\":%.4f,\"stdDev\":%.4f,"
          "\"nextPrediction\":%.4f,"
          "\"minC\":%.4f,\"maxC\":%.4f,\"averageC\":%.4f,\"medianC\":%.4f,\"rangeC\":%.4f,\"stdDevC\":%.4f,"
          "\"nextPredictionC\":%.4f,"
          "\"minIndex\":%d,\"maxIndex\":%d,"
          "\"rapidChangeDetected\":%d,\"maxDeltaC\":%.4f,\"rapidChangeFromIdx\":%d,\"rapidChangeToIdx\":%d,"
          "\"slopeC\":%.4f,\"trendCode\":%d,\"trend\":\"%s\","
          "\"categoryCounts\":{"
            "\"Freezing\":%d,\"Cold\":%d,\"Comfortable\":%d,\"Warm\":%d,\"Hot\":%d,\"ExtremeHeat\":%d"
          "}"
        "},"
        "\"readings\":[",
        stats.count,
        (char)toupper((unsigned char)unit_str[0]),
        temp_unit_symbol(unit),
        stats.min_val, stats.max_val, stats.avg_val, stats.median_val, stats.range_val, stats.std_dev_val,
        stats.next_prediction_val,
        stats.min_c, stats.max_c, stats.avg_c, stats.median_c, stats.range_c, stats.std_dev_c,
        stats.next_prediction_c,
        stats.min_index, stats.max_index,
        stats.rapid_change_detected, stats.max_delta_c, stats.rapid_change_from_idx, stats.rapid_change_to_idx,
        stats.slope_c, stats.trend_code, stats.trend_label,
        stats.category_counts[0], stats.category_counts[1], stats.category_counts[2],
        stats.category_counts[3], stats.category_counts[4], stats.category_counts[5]
    );

    for (int i = 0; i < count; i++) {
        TempConversionResult conv;
        temp_convert_all(values[i], unit, &conv);
        TempReadingClassification cls;
        temp_classify_celsius(conv.celsius, &cls);

        offset += snprintf(
            json + offset, cap - (size_t)offset,
            "%s{"
            "\"index\":%d,"
            "\"input\":%.4f,"
            "\"celsius\":%.4f,"
            "\"fahrenheit\":%.4f,"
            "\"kelvin\":%.4f,"
            "\"rankine\":%.4f,"
            "\"code\":%d,"
            "\"category\":\"%s\","
            "\"badge\":\"%s\","
            "\"message\":\"%s\","
            "\"recommendation\":\"%s\","
            "\"color\":\"%s\","
            "\"displayTheme\":\"%s\""
            "}",
            (i > 0) ? "," : "",
            i + 1,
            values[i],
            conv.celsius,
            conv.fahrenheit,
            conv.kelvin,
            conv.rankine,
            cls.code,
            cls.category,
            cls.badge,
            cls.message,
            cls.recommendation,
            cls.color_hex,
            cls.display_theme
        );
    }

    offset += snprintf(json + offset, cap - (size_t)offset, "]}");
    send_http_response(client, 200, "OK", "application/json; charset=utf-8", json, (size_t)offset);
    free(json);
}

int main(int argc, char *argv[]) {
    int port = DEFAULT_PORT;
    if (argc > 1) {
        int p = atoi(argv[1]);
        if (p > 0 && p < 65536) port = p;
    }

#ifdef _WIN32
    WSADATA wsa;
    if (WSAStartup(MAKEWORD(2, 2), &wsa) != 0) {
        fprintf(stderr, "Failed to initialize Winsock.\n");
        return 1;
    }
#endif

    SOCKET server_fd = socket(AF_INET, SOCK_STREAM, 0);
    if (server_fd == INVALID_SOCKET) {
        fprintf(stderr, "Failed to create socket.\n");
        return 1;
    }

    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, (const char *)&opt, sizeof(opt));

    struct sockaddr_in addr;
    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_addr.s_addr = htonl(INADDR_ANY);
    addr.sin_port = htons((unsigned short)port);

    if (bind(server_fd, (struct sockaddr *)&addr, sizeof(addr)) == SOCKET_ERROR) {
        fprintf(stderr, "Failed to bind to port %d. Is another instance running?\n", port);
        close_socket(server_fd);
        return 1;
    }

    if (listen(server_fd, 16) == SOCKET_ERROR) {
        fprintf(stderr, "Failed to listen on socket.\n");
        close_socket(server_fd);
        return 1;
    }

    printf("=========================================================================\n");
    printf("  SMART TEMPERATURE ANALYZER & CONVERTER - NATIVE C HTTP SERVER\n");
    printf("  Core Logic : /c/temperature.c + /c/temperature.h\n");
    printf("  URL        : http://localhost:%d\n", port);
    printf("  Endpoints  : /api/health | /api/convert | /api/analyze\n");
    printf("=========================================================================\n");
    fflush(stdout);

    char *buffer = (char *)malloc(BUFFER_SIZE);
    if (!buffer) return 1;

    while (1) {
        struct sockaddr_in client_addr;
        socklen_t client_len = sizeof(client_addr);
        SOCKET client = accept(server_fd, (struct sockaddr *)&client_addr, &client_len);
        if (client == INVALID_SOCKET) continue;

        int received = recv(client, buffer, BUFFER_SIZE - 1, 0);
        if (received <= 0) {
            close_socket(client);
            continue;
        }
        buffer[received] = '\0';

        char method[16] = "";
        char uri[2048]  = "";
        sscanf(buffer, "%15s %2047s", method, uri);

        if (strcmp(method, "OPTIONS") == 0) {
            send_http_response(client, 204, "No Content", "text/plain", "", 0);
            close_socket(client);
            continue;
        }

        /* Split path and query string */
        char *query = strchr(uri, '?');
        if (query) {
            *query = '\0';
            query++;
        } else {
            query = "";
        }

        if (strcmp(uri, "/api/health") == 0) {
            const char *health = "{\"status\":\"ok\",\"mode\":\"C-HTTP-Backend\",\"source\":\"/c/temperature.c\"}";
            send_http_response(client, 200, "OK", "application/json; charset=utf-8", health, strlen(health));
        } else if (strcmp(uri, "/api/convert") == 0) {
            handle_api_convert(client, query);
        } else if (strcmp(uri, "/api/analyze") == 0) {
            handle_api_analyze(client, query);
        } else if (strcmp(uri, "/") == 0 || strcmp(uri, "/index.html") == 0) {
            serve_static_file(client, "index.html", "text/html; charset=utf-8");
        } else if (strcmp(uri, "/styles.css") == 0) {
            serve_static_file(client, "styles.css", "text/css; charset=utf-8");
        } else if (strcmp(uri, "/script.js") == 0) {
            serve_static_file(client, "script.js", "application/javascript; charset=utf-8");
        } else if (strcmp(uri, "/c/temperature.c") == 0) {
            serve_static_file(client, "c/temperature.c", "text/plain; charset=utf-8");
        } else if (strcmp(uri, "/c/temperature.h") == 0) {
            serve_static_file(client, "c/temperature.h", "text/plain; charset=utf-8");
        } else if (strcmp(uri, "/wasm/temperature.js") == 0) {
            serve_static_file(client, "wasm/temperature.js", "application/javascript; charset=utf-8");
        } else if (strcmp(uri, "/wasm/temperature.wasm") == 0) {
            serve_static_file(client, "wasm/temperature.wasm", "application/wasm");
        } else {
            serve_static_file(client, "index.html", "text/html; charset=utf-8");
        }

        close_socket(client);
    }

    free(buffer);
    close_socket(server_fd);
#ifdef _WIN32
    WSACleanup();
#endif
    return 0;
}

