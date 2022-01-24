import {google} from "googleapis";
import {Config} from "../config";
import {logger} from "../logger";
import {CardInfoType} from "../types";

export type MajorDimension = "ROWS" | "COLUMNS";

const sheets = google.sheets("v4").spreadsheets;

export const AuthenticateGoogleAPI = async () => {
    const client = await google.auth.getClient({
        scopes: Config.sheets_api.scopes,
        credentials: {
            client_email: Config.sheets_api.client_email,
            private_key: Config.sheets_api.private_key,
        },
    });
    google.options({auth: client});
};

export const BuildRange = (sheet: string, startCell: string, endCell: string) => {
    return `${sheet}!${startCell}:${endCell}`;
};

/**
 * Gets data from `target`
 * @param target_id the ID of the sheet to read from
 * @param range the range of cells to read
 * @param major the major dimension. When ROWS, the data is returned as an array of rows (cols => array of cols)
 * @returns a response from the Sheets API containing the data
 */
export const GetRange = async (
    target_id: string,
    range: string,
    major: MajorDimension = "ROWS"
) =>
    sheets.values.get({
        spreadsheetId: target_id,
        range: range,
        majorDimension: major,
    });

/**
 * Returns the data in a single column of `targetSheet` on page `sheetNumber` in column-major form
 * @param target the ID of the sheet to read data from
 * @param col a single letter, identifying the column read from
 * @param target_sheet an optional number, specifying the page number of the `target` to read from
 * @returns a string array of the data in column `col` of `target`'s page `page`
 */
export const GetColumn = async (
    target_id: string,
    target_sheet: string = "Sheet1",
    col: string
): Promise<string[]> => {
    const range = BuildRange(target_sheet, col, col);
    return (await GetRange(target_id, range, "COLUMNS")).data.values![0];
};

/**
 * Returns the data in a single row of `target` on page `page` in row-major form
 * @param target_id the ID of the sheet to read data from
 * @param row a single number, identifying the row to get data from. First row is `1`.
 * @param page an optional number, specifying the page number of the `target` to read from
 * @returns a string array of the data in row `row` of `target`'s page `page`
 */
export const GetRow = async (
    target_id: string,
    target_sheet: string = "Sheet1",
    row: number | string
): Promise<string[]> => {
    const range = BuildRange(target_sheet, `${row}`, `${row}`);
    return (await GetRange(target_id, range, "ROWS")).data.values![0];
};

export const GetUserData = async (
    target_id: string,
    target_sheet: string,
    row: number | string
): Promise<CardInfoType> => {
    const rowData = await GetRow(target_id, target_sheet, row);
    return {
        authorizedCard: rowData[15] === "TRUE",
        firstName: rowData[0],
        lastName: rowData[1],
        pronouns: rowData[6],
        github: rowData[11],
        linkedIn: rowData[10],
        website: rowData[12],
        resume: rowData[13],
        studyArea: rowData[7],
        studyLocation: rowData[4],
        phone: rowData[2],
        email: rowData[3],
    };
};
