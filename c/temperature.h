/*
 * ============================================================================
 * FILE        : c/temperature.h
 * PROJECT     : Smart Temperature Analyzer & Converter with Intelligent Alerts
 * DESCRIPTION : Header file for core C temperature conversion, step-by-step
 *               formula formatting, thermodynamic validation, statistical
 *               analysis, next-reading prediction, rapid-change detection,
 *               and 6-tier alert classification.
 * ============================================================================
 */

#ifndef TEMPERATURE_H
#define TEMPERATURE_H

#ifdef __cplusplus
extern "C" {
#endif

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define EXPORT_FN EMSCRIPTEN_KEEPALIVE
#else
#define EXPORT_FN
#endif

/* Supported Temperature Unit Codes */
typedef enum {
    UNIT_CELSIUS    = 0, /* °C */
    UNIT_FAHRENHEIT = 1, /* °F */
    UNIT_KELVIN     = 2, /* K  */
    UNIT_RANKINE    = 3  /* °R */
} TempUnit;

/* Alert Classification Codes */
typedef enum {
    ALERT_FREEZING     = 0, /* <= 0.0 °C         */
    ALERT_COLD         = 1, /* > 0.0 to 15.0 °C  */
    ALERT_COMFORTABLE  = 2, /* > 15.0 to 25.0 °C */
    ALERT_WARM         = 3, /* > 25.0 to 35.0 °C */
    ALERT_HOT          = 4, /* > 35.0 to 45.0 °C */
    ALERT_EXTREME_HEAT = 5  /* > 45.0 °C         */
} AlertLevelCode;

/* Trend Codes */
typedef enum {
    TREND_STABLE  = 0,
    TREND_RISING  = 1,
    TREND_FALLING = -1
} TrendCode;

/* Thermodynamic Absolute Zero Constants */
#define ABS_ZERO_CELSIUS    -273.15
#define ABS_ZERO_FAHRENHEIT -459.67
#define ABS_ZERO_KELVIN      0.00
#define ABS_ZERO_RANKINE     0.00

/* Rapid Change Threshold in Celsius between consecutive readings */
#define RAPID_CHANGE_THRESHOLD_C 8.0

/* Structure holding all 4 converted unit values */
typedef struct {
    int is_valid;
    double input_value;
    int input_unit;
    double celsius;
    double fahrenheit;
    double kelvin;
    double rankine;
    char error_message[128];
} TempConversionResult;

/* Structure holding intelligent alert classification for a single reading */
typedef struct {
    int code;
    double celsius;
    char category[32];
    char badge[24];
    char message[128];
    char recommendation[160];
    char color_hex[16];
    char display_theme[16]; /* "low", "medium", or "high" */
} TempReadingClassification;

/* Structure holding comprehensive multi-reading statistical analysis */
typedef struct {
    int count;
    int input_unit;
    double min_val;
    double max_val;
    double avg_val;
    double median_val;
    double range_val;
    double std_dev_val;
    double next_prediction_val;
    /* Celsius equivalents */
    double min_c;
    double max_c;
    double avg_c;
    double median_c;
    double range_c;
    double std_dev_c;
    double next_prediction_c;
    double slope_c;
    int min_index;          /* 1-based index of coldest reading */
    int max_index;          /* 1-based index of hottest reading */
    int rapid_change_detected;
    double max_delta_c;
    int rapid_change_from_idx;
    int rapid_change_to_idx;
    int trend_code;         /* 1 = Rising, -1 = Falling, 0 = Stable */
    char trend_label[24];
    int category_counts[6]; /* Freezing, Cold, Comfortable, Warm, Hot, Extreme Heat */
} TempStatsResult;

/* ==================== EXPORTED C FUNCTIONS ==================== */

EXPORT_FN int temp_unit_from_char(char c);
EXPORT_FN const char* temp_unit_symbol(int unit);
EXPORT_FN double temp_get_abs_zero(int unit);
EXPORT_FN int temp_validate(double value, int unit);
EXPORT_FN double temp_convert_pair(double value, int from_unit, int to_unit);
EXPORT_FN int temp_convert_all(double value, int from_unit, TempConversionResult *out);
EXPORT_FN const char* temp_get_formula(int from_unit, int to_unit);
EXPORT_FN void temp_get_step_formula(double value, int from_unit, int to_unit, char *out_buf, int buf_size);
EXPORT_FN int temp_classify_celsius(double celsius, TempReadingClassification *out);
EXPORT_FN int temp_analyze_array(const double *values, int count, int input_unit, TempStatsResult *out);

#ifdef __cplusplus
}
#endif

#endif /* TEMPERATURE_H */
