/*
 * ============================================================================
 * FILE        : c/temperature.c
 * PROJECT     : Smart Temperature Analyzer & Converter with Intelligent Alerts
 * DESCRIPTION : Core C implementation of temperature conversion, step-by-step
 *               formula formatting, physical validation, multi-reading
 *               statistics (min, max, mean, median, range, std dev, trend,
 *               next-reading prediction, rapid-change detection), and 6-tier
 *               intelligent alert classification.
 * ============================================================================
 */

#include "temperature.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <math.h>
#include <ctype.h>

#define EPSILON 1e-7

static double clean_zero(double v) {
    return (fabs(v) < 1e-9) ? 0.0 : v;
}

static int compare_doubles(const void *a, const void *b) {
    double da = *(const double *)a;
    double db = *(const double *)b;
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
}

EXPORT_FN int temp_unit_from_char(char c) {
    char upper = (char)toupper((unsigned char)c);
    switch (upper) {
        case 'C': return UNIT_CELSIUS;
        case 'F': return UNIT_FAHRENHEIT;
        case 'K': return UNIT_KELVIN;
        case 'R': return UNIT_RANKINE;
        default:  return -1;
    }
}

EXPORT_FN const char* temp_unit_symbol(int unit) {
    switch (unit) {
        case UNIT_CELSIUS:    return "°C";
        case UNIT_FAHRENHEIT: return "°F";
        case UNIT_KELVIN:     return "K";
        case UNIT_RANKINE:    return "°R";
        default:              return "?";
    }
}

EXPORT_FN double temp_get_abs_zero(int unit) {
    switch (unit) {
        case UNIT_CELSIUS:    return ABS_ZERO_CELSIUS;
        case UNIT_FAHRENHEIT: return ABS_ZERO_FAHRENHEIT;
        case UNIT_KELVIN:     return ABS_ZERO_KELVIN;
        case UNIT_RANKINE:    return ABS_ZERO_RANKINE;
        default:              return ABS_ZERO_CELSIUS;
    }
}

EXPORT_FN int temp_validate(double value, int unit) {
    if (isnan(value) || isinf(value)) {
        return 0;
    }
    switch (unit) {
        case UNIT_CELSIUS:
            return (value >= ABS_ZERO_CELSIUS - EPSILON) ? 1 : 0;
        case UNIT_FAHRENHEIT:
            return (value >= ABS_ZERO_FAHRENHEIT - EPSILON) ? 1 : 0;
        case UNIT_KELVIN:
            return (value >= ABS_ZERO_KELVIN - EPSILON) ? 1 : 0;
        case UNIT_RANKINE:
            return (value >= ABS_ZERO_RANKINE - EPSILON) ? 1 : 0;
        default:
            return 0;
    }
}

static double to_celsius(double value, int from_unit) {
    switch (from_unit) {
        case UNIT_CELSIUS:    return value;
        case UNIT_FAHRENHEIT: return (value - 32.0) * 5.0 / 9.0;
        case UNIT_KELVIN:     return value - 273.15;
        case UNIT_RANKINE:    return (value - 491.67) * 5.0 / 9.0;
        default:              return value;
    }
}

static double from_celsius(double celsius, int to_unit) {
    switch (to_unit) {
        case UNIT_CELSIUS:    return celsius;
        case UNIT_FAHRENHEIT: return (celsius * 9.0 / 5.0) + 32.0;
        case UNIT_KELVIN:     return celsius + 273.15;
        case UNIT_RANKINE:    return (celsius + 273.15) * 9.0 / 5.0;
        default:              return celsius;
    }
}

EXPORT_FN double temp_convert_pair(double value, int from_unit, int to_unit) {
    if (from_unit == to_unit) {
        return clean_zero(value);
    }
    double c = to_celsius(value, from_unit);
    double res = from_celsius(c, to_unit);
    return clean_zero(res);
}

EXPORT_FN int temp_convert_all(double value, int from_unit, TempConversionResult *out) {
    if (out == NULL) return 0;

    memset(out, 0, sizeof(TempConversionResult));
    out->input_value = value;
    out->input_unit  = from_unit;

    if (!temp_validate(value, from_unit)) {
        out->is_valid = 0;
        snprintf(
            out->error_message,
            sizeof(out->error_message),
            "INVALID TEMPERATURE! Value %.2f %s is below Absolute Zero (%.2f %s).",
            value,
            temp_unit_symbol(from_unit),
            temp_get_abs_zero(from_unit),
            temp_unit_symbol(from_unit)
        );
        return 0;
    }

    double c = to_celsius(value, from_unit);
    out->is_valid   = 1;
    out->celsius    = clean_zero(c);
    out->fahrenheit = clean_zero(from_celsius(c, UNIT_FAHRENHEIT));
    out->kelvin     = clean_zero(from_celsius(c, UNIT_KELVIN));
    out->rankine    = clean_zero(from_celsius(c, UNIT_RANKINE));
    out->error_message[0] = '\0';
    return 1;
}

EXPORT_FN const char* temp_get_formula(int from_unit, int to_unit) {
    if (from_unit == UNIT_CELSIUS) {
        switch (to_unit) {
            case UNIT_CELSIUS:    return "°C = °C (Identity)";
            case UNIT_FAHRENHEIT: return "°F = (°C × 9/5) + 32";
            case UNIT_KELVIN:     return "K = °C + 273.15";
            case UNIT_RANKINE:    return "°R = (°C + 273.15) × 9/5";
        }
    } else if (from_unit == UNIT_FAHRENHEIT) {
        switch (to_unit) {
            case UNIT_CELSIUS:    return "°C = (°F − 32) × 5/9";
            case UNIT_FAHRENHEIT: return "°F = °F (Identity)";
            case UNIT_KELVIN:     return "K = (°F − 32) × 5/9 + 273.15";
            case UNIT_RANKINE:    return "°R = °F + 459.67";
        }
    } else if (from_unit == UNIT_KELVIN) {
        switch (to_unit) {
            case UNIT_CELSIUS:    return "°C = K − 273.15";
            case UNIT_FAHRENHEIT: return "°F = (K − 273.15) × 9/5 + 32";
            case UNIT_KELVIN:     return "K = K (Identity)";
            case UNIT_RANKINE:    return "°R = K × 9/5";
        }
    } else if (from_unit == UNIT_RANKINE) {
        switch (to_unit) {
            case UNIT_CELSIUS:    return "°C = (°R − 491.67) × 5/9";
            case UNIT_FAHRENHEIT: return "°F = °R − 459.67";
            case UNIT_KELVIN:     return "K = °R × 5/9";
            case UNIT_RANKINE:    return "°R = °R (Identity)";
        }
    }
    return "T_out = f(T_in)";
}

/* Format a detailed step-by-step calculation string in C */
EXPORT_FN void temp_get_step_formula(double value, int from_unit, int to_unit, char *out_buf, int buf_size) {
    if (!out_buf || buf_size <= 0) return;
    double res = temp_convert_pair(value, from_unit, to_unit);

    if (from_unit == to_unit) {
        snprintf(out_buf, (size_t)buf_size, "Step 1: Identical unit selected -> %.2f %s = %.2f %s",
                 value, temp_unit_symbol(from_unit), res, temp_unit_symbol(to_unit));
        return;
    }

    if (from_unit == UNIT_CELSIUS && to_unit == UNIT_FAHRENHEIT) {
        double s1 = value * 1.8;
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f × 9/5 = %.2f  →  Step 2: %.2f + 32 = %.2f °F",
                 value, s1, s1, res);
    } else if (from_unit == UNIT_CELSIUS && to_unit == UNIT_KELVIN) {
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f + 273.15 = %.2f K",
                 value, res);
    } else if (from_unit == UNIT_CELSIUS && to_unit == UNIT_RANKINE) {
        double s1 = value + 273.15;
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f + 273.15 = %.2f K  →  Step 2: %.2f × 9/5 = %.2f °R",
                 value, s1, s1, res);
    } else if (from_unit == UNIT_FAHRENHEIT && to_unit == UNIT_CELSIUS) {
        double s1 = value - 32.0;
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f − 32 = %.2f  →  Step 2: %.2f × 5/9 = %.2f °C",
                 value, s1, s1, res);
    } else if (from_unit == UNIT_FAHRENHEIT && to_unit == UNIT_KELVIN) {
        double s1 = value - 32.0;
        double s2 = s1 * 5.0 / 9.0;
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: (%.2f − 32) × 5/9 = %.2f °C  →  Step 2: %.2f + 273.15 = %.2f K",
                 value, s2, s2, res);
    } else if (from_unit == UNIT_FAHRENHEIT && to_unit == UNIT_RANKINE) {
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f + 459.67 = %.2f °R",
                 value, res);
    } else if (from_unit == UNIT_KELVIN && to_unit == UNIT_CELSIUS) {
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f − 273.15 = %.2f °C",
                 value, res);
    } else if (from_unit == UNIT_KELVIN && to_unit == UNIT_FAHRENHEIT) {
        double s1 = value - 273.15;
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f − 273.15 = %.2f °C  →  Step 2: (%.2f × 9/5) + 32 = %.2f °F",
                 value, s1, s1, res);
    } else if (from_unit == UNIT_KELVIN && to_unit == UNIT_RANKINE) {
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: %.2f × 9/5 = %.2f °R",
                 value, res);
    } else {
        double c = to_celsius(value, from_unit);
        snprintf(out_buf, (size_t)buf_size,
                 "Step 1: Convert %.2f %s to %.2f °C  →  Step 2: Convert to %.2f %s",
                 value, temp_unit_symbol(from_unit), c, res, temp_unit_symbol(to_unit));
    }
}

EXPORT_FN int temp_classify_celsius(double celsius, TempReadingClassification *out) {
    if (out == NULL) return -1;

    out->celsius = clean_zero(celsius);

    if (celsius <= 0.0) {
        out->code = ALERT_FREEZING;
        strcpy(out->category, "Freezing");
        strcpy(out->badge, "CRYOGENIC / FREEZING");
        strcpy(out->message, "Very cold temperature detected (<= 0°C). Sub-zero freezing condition.");
        strcpy(out->recommendation, "Insulate pipes & equipment; monitor for frost and ice formation.");
        strcpy(out->color_hex, "#38bdf8");
        strcpy(out->display_theme, "low");
    } else if (celsius <= 15.0) {
        out->code = ALERT_COLD;
        strcpy(out->category, "Cold");
        strcpy(out->badge, "LOW TEMPERATURE");
        strcpy(out->message, "Low temperature detected (0°C to 15°C). Cool thermal environment.");
        strcpy(out->recommendation, "Maintain thermal regulation; suitable for cold-storage monitoring.");
        strcpy(out->color_hex, "#3b82f6");
        strcpy(out->display_theme, "low");
    } else if (celsius <= 25.0) {
        out->code = ALERT_COMFORTABLE;
        strcpy(out->category, "Comfortable");
        strcpy(out->badge, "OPTIMAL / NORMAL");
        strcpy(out->message, "Temperature is in the comfortable normal range (15°C to 25°C).");
        strcpy(out->recommendation, "No corrective action required; ideal ambient operating conditions.");
        strcpy(out->color_hex, "#10b981");
        strcpy(out->display_theme, "medium");
    } else if (celsius <= 35.0) {
        out->code = ALERT_WARM;
        strcpy(out->category, "Warm");
        strcpy(out->badge, "ELEVATED WARM");
        strcpy(out->message, "Warm temperature detected (25°C to 35°C). Moderate thermal load.");
        strcpy(out->recommendation, "Ensure adequate ventilation and airflow across active systems.");
        strcpy(out->color_hex, "#f59e0b");
        strcpy(out->display_theme, "medium");
    } else if (celsius <= 45.0) {
        out->code = ALERT_HOT;
        strcpy(out->category, "Hot");
        strcpy(out->badge, "HIGH HEAT WARNING");
        strcpy(out->message, "High temperature detected (35°C to 45°C). Thermal stress warning!");
        strcpy(out->recommendation, "Activate active cooling systems and inspect for overheating.");
        strcpy(out->color_hex, "#f97316");
        strcpy(out->display_theme, "high");
    } else {
        out->code = ALERT_EXTREME_HEAT;
        strcpy(out->category, "Extreme Heat / Danger");
        strcpy(out->badge, "CRITICAL DANGER");
        strcpy(out->message, "CRITICAL ALERT! Extreme heat / danger level (> 45°C) exceeded!");
        strcpy(out->recommendation, "Immediate thermal shutdown or emergency cooling intervention required!");
        strcpy(out->color_hex, "#ef4444");
        strcpy(out->display_theme, "high");
    }

    return out->code;
}

EXPORT_FN int temp_analyze_array(const double *values, int count, int input_unit, TempStatsResult *out) {
    if (values == NULL || out == NULL || count <= 0) {
        return 0;
    }

    memset(out, 0, sizeof(TempStatsResult));
    out->count = count;
    out->input_unit = input_unit;

    double *sorted_input = (double *)malloc((size_t)count * sizeof(double));
    double *celsius_vals = (double *)malloc((size_t)count * sizeof(double));
    double *sorted_c     = (double *)malloc((size_t)count * sizeof(double));

    if (!sorted_input || !celsius_vals || !sorted_c) {
        free(sorted_input);
        free(celsius_vals);
        free(sorted_c);
        return 0;
    }

    double sum_in = 0.0;
    double sum_c  = 0.0;
    int min_idx = 0;
    int max_idx = 0;

    for (int i = 0; i < count; i++) {
        double v = values[i];
        if (!temp_validate(v, input_unit)) {
            free(sorted_input);
            free(celsius_vals);
            free(sorted_c);
            return 0;
        }
        double c = to_celsius(v, input_unit);
        sorted_input[i] = v;
        celsius_vals[i] = c;
        sorted_c[i]     = c;

        if (i == 0 || c < celsius_vals[min_idx]) min_idx = i;
        if (i == 0 || c > celsius_vals[max_idx]) max_idx = i;

        if (i > 0) {
            double delta = fabs(c - celsius_vals[i - 1]);
            if (delta > out->max_delta_c) {
                out->max_delta_c = clean_zero(delta);
                out->rapid_change_from_idx = i;     /* 1-based: i */
                out->rapid_change_to_idx   = i + 1; /* 1-based: i + 1 */
            }
            if (delta >= RAPID_CHANGE_THRESHOLD_C) {
                out->rapid_change_detected = 1;
            }
        }

        sum_in += v;
        sum_c  += c;

        TempReadingClassification cls;
        int code = temp_classify_celsius(c, &cls);
        if (code >= 0 && code < 6) {
            out->category_counts[code]++;
        }
    }

    out->min_index = min_idx + 1;
    out->max_index = max_idx + 1;

    qsort(sorted_input, (size_t)count, sizeof(double), compare_doubles);
    qsort(sorted_c,     (size_t)count, sizeof(double), compare_doubles);

    out->min_val = clean_zero(sorted_input[0]);
    out->max_val = clean_zero(sorted_input[count - 1]);
    out->avg_val = clean_zero(sum_in / (double)count);
    out->range_val = clean_zero(out->max_val - out->min_val);

    out->min_c = clean_zero(sorted_c[0]);
    out->max_c = clean_zero(sorted_c[count - 1]);
    out->avg_c = clean_zero(sum_c / (double)count);
    out->range_c = clean_zero(out->max_c - out->min_c);

    if (count % 2 == 1) {
        out->median_val = clean_zero(sorted_input[count / 2]);
        out->median_c   = clean_zero(sorted_c[count / 2]);
    } else {
        int mid = count / 2;
        out->median_val = clean_zero((sorted_input[mid - 1] + sorted_input[mid]) / 2.0);
        out->median_c   = clean_zero((sorted_c[mid - 1] + sorted_c[mid]) / 2.0);
    }

    double sq_diff_in = 0.0;
    double sq_diff_c  = 0.0;
    for (int i = 0; i < count; i++) {
        double d_in = values[i] - out->avg_val;
        double d_c  = celsius_vals[i] - out->avg_c;
        sq_diff_in += d_in * d_in;
        sq_diff_c  += d_c * d_c;
    }
    out->std_dev_val = clean_zero(sqrt(sq_diff_in / (double)count));
    out->std_dev_c   = clean_zero(sqrt(sq_diff_c / (double)count));

    /* Linear regression slope + Next-Reading Prediction at index x = count */
    if (count < 2) {
        out->slope_c = 0.0;
        out->trend_code = TREND_STABLE;
        strcpy(out->trend_label, "Stable");
        out->next_prediction_c   = out->avg_c;
        out->next_prediction_val = out->avg_val;
    } else {
        double mean_x = (double)(count - 1) / 2.0;
        double num = 0.0;
        double den = 0.0;
        for (int i = 0; i < count; i++) {
            double dx = (double)i - mean_x;
            double dy = celsius_vals[i] - out->avg_c;
            num += dx * dy;
            den += dx * dx;
        }
        double slope = (den > 0.0) ? (num / den) : 0.0;
        out->slope_c = clean_zero(slope);

        double intercept_c = out->avg_c - slope * mean_x;
        double pred_c = intercept_c + slope * (double)count;
        /* Clamp prediction to Absolute Zero */
        if (pred_c < ABS_ZERO_CELSIUS) pred_c = ABS_ZERO_CELSIUS;
        out->next_prediction_c   = clean_zero(pred_c);
        out->next_prediction_val = clean_zero(from_celsius(pred_c, input_unit));

        if (slope > 0.25) {
            out->trend_code = TREND_RISING;
            strcpy(out->trend_label, "Rising");
        } else if (slope < -0.25) {
            out->trend_code = TREND_FALLING;
            strcpy(out->trend_label, "Falling");
        } else {
            out->trend_code = TREND_STABLE;
            strcpy(out->trend_label, "Stable");
        }
    }

    free(sorted_input);
    free(celsius_vals);
    free(sorted_c);
    return 1;
}
