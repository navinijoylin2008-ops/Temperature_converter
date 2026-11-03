/*
 * ============================================================================
 * PROJECT TITLE : SMART TEMPERATURE ANALYZER & CONVERTER WITH INTELLIGENT ALERTS
 * LANGUAGE      : C Programming (ANSI C / C99)
 * COURSE OUTCOMES COVERED:
 *   - CO1: Develop algorithms and pseudocode.
 *   - CO2: Develop C programs using branching and looping techniques.
 *   - CO4: Develop programs using functions.
 *   - CO5: Use pointers, dynamic memory allocation, structures and file handling.
 * ============================================================================
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>

/* Physical Thermodynamic Constants (Absolute Zero) */
#define ABS_ZERO_C -273.15
#define ABS_ZERO_F -459.67
#define ABS_ZERO_K  0.00

/* Structure to store a complete temperature reading (CO5: Structures) */
typedef struct {
    int id;
    char timestamp[32];
    double inputValue;
    char inputUnit;
    double celsius;
    double fahrenheit;
    double kelvin;
    char category[20];
    char alertMessage[80];
} TemperatureRecord;

/* Function Prototypes (CO4: User-Defined Functions & CO5: Pointers) */
int validateTemperature(double value, char unit);
void convertTemperature(TemperatureRecord *rec);
void analyzeAndAlert(TemperatureRecord *rec);
void displaySingleResult(const TemperatureRecord *rec);
void displayLatestFiveHistory(const TemperatureRecord *history, int count);
void displayStatistics(const TemperatureRecord *history, int count);
int exportReportToFile(const TemperatureRecord *history, int count);

int main(void) {
    int capacity = 5;
    int count = 0;
    int choice;
    char repeatChoice;

    /* Dynamic Memory Allocation for storing readings (CO5: malloc) */
    TemperatureRecord *history = (TemperatureRecord *)malloc(capacity * sizeof(TemperatureRecord));
    if (history == NULL) {
        printf("Memory allocation failed!\n");
        return 1;
    }

    printf("====================================================================\n");
    printf("   SMART TEMPERATURE ANALYZER & CONVERTER WITH INTELLIGENT ALERTS   \n");
    printf("              Convert. Analyze. Monitor. Stay Informed.             \n");
    printf("====================================================================\n");

    /* Main Menu Loop (CO2: Looping with do-while) */
    do {
        printf("\n--------------------------- MAIN MENU ---------------------------\n");
        printf("1. Convert & Analyze Temperature\n");
        printf("2. View Latest 5 Readings (History)\n");
        printf("3. View Temperature Statistics\n");
        printf("4. Download / Export Analysis Report to File\n");
        printf("5. Clear History\n");
        printf("0. Exit Program\n");
        printf("Enter your choice: ");

        if (scanf("%d", &choice) != 1) {
            printf("\n[ERROR] Invalid numeric menu input! Clearing buffer...\n");
            while (getchar() != '\n');
            continue;
        }

        /* Multi-way Branching (CO2: switch statement) */
        switch (choice) {
            case 1: {
                do {
                    int unitOption;
                    double enteredTemp;
                    char selectedUnit = 'C';

                    printf("\nSelect Input Temperature Unit:\n");
                    printf("  1. Celsius (C)\n");
                    printf("  2. Fahrenheit (F)\n");
                    printf("  3. Kelvin (K)\n");
                    printf("Enter unit option (1-3): ");

                    if (scanf("%d", &unitOption) != 1 || unitOption < 1 || unitOption > 3) {
                        printf("\nINVALID INPUT! Please select unit 1, 2, or 3.\n");
                        while (getchar() != '\n');
                        break;
                    }

                    if (unitOption == 1) selectedUnit = 'C';
                    else if (unitOption == 2) selectedUnit = 'F';
                    else selectedUnit = 'K';

                    printf("Enter temperature value in %c: ", selectedUnit);
                    if (scanf("%lf", &enteredTemp) != 1) {
                        printf("\nINVALID TEMPERATURE! Non-numeric input detected.\n");
                        while (getchar() != '\n');
                        break;
                    }

                    /* Validate against Absolute Zero (CO2 & CO4) */
                    if (!validateTemperature(enteredTemp, selectedUnit)) {
                        printf("\n==================================================\n");
                        printf("INVALID TEMPERATURE!\n");
                        printf("Temperature cannot be below absolute zero.\n");
                        printf("(Limits: -273.15 C | -459.67 F | 0.00 K)\n");
                        printf("==================================================\n");
                    } else {
                        /* Expand dynamic array if full (CO5: realloc) */
                        if (count >= capacity) {
                            capacity *= 2;
                            TemperatureRecord *tempPtr = (TemperatureRecord *)realloc(
                                history, capacity * sizeof(TemperatureRecord)
                            );
                            if (tempPtr == NULL) {
                                printf("Error expanding memory!\n");
                                break;
                            }
                            history = tempPtr;
                        }

                        /* Populate Record via Pointer (CO5: Pointers) */
                        TemperatureRecord *current = &history[count];
                        current->id = count + 1;
                        current->inputValue = enteredTemp;
                        current->inputUnit = selectedUnit;

                        time_t now = time(NULL);
                        struct tm *t = localtime(&now);
                        strftime(current->timestamp, sizeof(current->timestamp), "%Y-%m-%d %H:%M:%S", t);

                        convertTemperature(current);
                        analyzeAndAlert(current);
                        displaySingleResult(current);

                        count++;
                    }

                    printf("\nWould you like to repeat conversion? (y/n): ");
                    scanf(" %c", &repeatChoice);
                } while (repeatChoice == 'y' || repeatChoice == 'Y');
                break;
            }

            case 2:
                displayLatestFiveHistory(history, count);
                break;

            case 3:
                displayStatistics(history, count);
                break;

            case 4:
                if (exportReportToFile(history, count)) {
                    printf("\n[SUCCESS] Report saved to 'Temperature_Analysis_Report.txt'\n");
                }
                break;

            case 5:
                count = 0;
                printf("\n[INFO] Temperature history cleared successfully.\n");
                break;

            case 0:
                printf("\nExiting Smart Temperature Analyzer. Stay Informed!\n");
                break;

            default:
                printf("\n[WARNING] Invalid choice! Please choose between 0 and 5.\n");
        }
    } while (choice != 0);

    /* Free Dynamically Allocated Memory (CO5: free) */
    free(history);
    return 0;
}

/* Validates that temperature is not below Absolute Zero */
int validateTemperature(double value, char unit) {
    switch (unit) {
        case 'C': return (value >= ABS_ZERO_C);
        case 'F': return (value >= ABS_ZERO_F);
        case 'K': return (value >= ABS_ZERO_K);
        default:  return 0;
    }
}

/* Converts input temperature into Celsius, Fahrenheit, and Kelvin */
void convertTemperature(TemperatureRecord *rec) {
    switch (rec->inputUnit) {
        case 'C':
            rec->celsius    = rec->inputValue;
            rec->fahrenheit = (rec->celsius * 9.0 / 5.0) + 32.0;
            rec->kelvin     = rec->celsius + 273.15;
            break;
        case 'F':
            rec->fahrenheit = rec->inputValue;
            rec->celsius    = (rec->fahrenheit - 32.0) * 5.0 / 9.0;
            rec->kelvin     = rec->celsius + 273.15;
            break;
        case 'K':
            rec->kelvin     = rec->inputValue;
            rec->celsius    = rec->kelvin - 273.15;
            rec->fahrenheit = (rec->celsius * 9.0 / 5.0) + 32.0;
            break;
    }
}

/* Classifies temperature and generates Intelligent Alert message */
void analyzeAndAlert(TemperatureRecord *rec) {
    double c = rec->celsius;

    if (c <= 0.0) {
        strcpy(rec->category, "Freezing");
        strcpy(rec->alertMessage, "Very cold temperature detected.");
    } else if (c <= 15.0) {
        strcpy(rec->category, "Cold");
        strcpy(rec->alertMessage, "Low temperature detected.");
    } else if (c <= 25.0) {
        strcpy(rec->category, "Normal");
        strcpy(rec->alertMessage, "Temperature is in the normal project-defined range.");
    } else if (c <= 35.0) {
        strcpy(rec->category, "Warm");
        strcpy(rec->alertMessage, "Warm temperature detected.");
    } else {
        strcpy(rec->category, "Hot");
        strcpy(rec->alertMessage, "High temperature detected.");
    }
}

/* Displays the converted values, category, and alert for a single reading */
void displaySingleResult(const TemperatureRecord *rec) {
    printf("\n=================== ANALYSIS RESULT ===================\n");
    printf("Entered Input : %.2f %c\n", rec->inputValue, rec->inputUnit);
    printf("-------------------------------------------------------\n");
    printf("  Celsius     : %.2f C\n", rec->celsius);
    printf("  Fahrenheit  : %.2f F\n", rec->fahrenheit);
    printf("  Kelvin      : %.2f K\n", rec->kelvin);
    printf("-------------------------------------------------------\n");
    printf("  Category    : %s\n", rec->category);
    printf("  Alert       : %s\n", rec->alertMessage);
    printf("=======================================================\n");
}

/* Displays the latest 5 readings stored in history */
void displayLatestFiveHistory(const TemperatureRecord *history, int count) {
    if (count == 0) {
        printf("\n[INFO] No temperature readings recorded yet.\n");
        return;
    }

    int start = (count > 5) ? (count - 5) : 0;
    printf("\n===================== LATEST 5 TEMPERATURE READINGS =====================\n");
    printf("%-4s | %-19s | %-10s | %-9s | %-9s | %-9s | %-10s\n",
           "#", "Timestamp", "Input", "Celsius", "Fahrenheit", "Kelvin", "Category");
    printf("-------------------------------------------------------------------------\n");

    for (int i = count - 1; i >= start; i--) {
        printf("%-4d | %-19s | %7.2f %c  | %7.2f C | %7.2f F  | %7.2f K | %-10s\n",
               history[i].id,
               history[i].timestamp,
               history[i].inputValue,
               history[i].inputUnit,
               history[i].celsius,
               history[i].fahrenheit,
               history[i].kelvin,
               history[i].category);
    }
}

/* Calculates and displays temperature statistics */
void displayStatistics(const TemperatureRecord *history, int count) {
    if (count == 0) {
        printf("\n[INFO] No valid readings available to compute statistics.\n");
        return;
    }

    double highest = history[0].celsius;
    double lowest  = history[0].celsius;
    double sum     = 0.0;
    int cFreezing = 0, cCold = 0, cNormal = 0, cWarm = 0, cHot = 0;

    for (int i = 0; i < count; i++) {
        double c = history[i].celsius;
        if (c > highest) highest = c;
        if (c < lowest)  lowest  = c;
        sum += c;

        if (c <= 0.0)       cFreezing++;
        else if (c <= 15.0) cCold++;
        else if (c <= 25.0) cNormal++;
        else if (c <= 35.0) cWarm++;
        else                cHot++;
    }

    printf("\n================== TEMPERATURE STATISTICS ==================\n");
    printf("Total Valid Readings : %d\n", count);
    printf("Highest Temperature  : %.2f C (%.2f F / %.2f K)\n",
           highest, (highest * 9.0 / 5.0) + 32.0, highest + 273.15);
    printf("Lowest Temperature   : %.2f C (%.2f F / %.2f K)\n",
           lowest, (lowest * 9.0 / 5.0) + 32.0, lowest + 273.15);
    printf("Average Temperature  : %.2f C\n", sum / count);
    printf("------------------------------------------------------------\n");
    printf("Category Distribution:\n");
    printf("  Freezing (<= 0 C)   : %d\n", cFreezing);
    printf("  Cold (0 - 15 C)     : %d\n", cCold);
    printf("  Normal (15 - 25 C)  : %d\n", cNormal);
    printf("  Warm (25 - 35 C)    : %d\n", cWarm);
    printf("  Hot (> 35 C)        : %d\n", cHot);
    printf("============================================================\n");
}

/* Exports complete report using C File Handling (CO5: fopen, fprintf, fclose) */
int exportReportToFile(const TemperatureRecord *history, int count) {
    FILE *fp = fopen("Temperature_Analysis_Report.txt", "w");
    if (fp == NULL) {
        printf("\n[ERROR] Unable to create report file!\n");
        return 0;
    }

    time_t now = time(NULL);
    fprintf(fp, "========================================================================\n");
    fprintf(fp, "  SMART TEMPERATURE ANALYZER & CONVERTER WITH INTELLIGENT ALERTS\n");
    fprintf(fp, "  Generated Date & Time: %s", ctime(&now));
    fprintf(fp, "========================================================================\n\n");

    if (count == 0) {
        fprintf(fp, "No temperature readings recorded during session.\n");
        fclose(fp);
        return 1;
    }

    fprintf(fp, "RECORDED READINGS:\n");
    fprintf(fp, "------------------------------------------------------------------------\n");
    for (int i = 0; i < count; i++) {
        fprintf(fp, "#%d [%s] Input: %.2f %c -> %.2f C | %.2f F | %.2f K | Category: %s | Alert: %s\n",
                history[i].id,
                history[i].timestamp,
                history[i].inputValue,
                history[i].inputUnit,
                history[i].celsius,
                history[i].fahrenheit,
                history[i].kelvin,
                history[i].category,
                history[i].alertMessage);
    }

    fclose(fp);
    return 1;
}

