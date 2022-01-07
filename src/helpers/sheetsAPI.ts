import {google} from "googleapis";
import {Config} from "../config";

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

export const buildRange = (sheetNumber: number, startCell: string, endCell: string) => {
    return `Sheet${sheetNumber}!${startCell}:${endCell}`;
};

/**
 * Gets data from `target`
 * @param target the ID of the sheet to read from
 * @param range the range of cells to read
 * @param major the major dimension. When ROWS, the data is returned as an array of rows (cols => array of cols)
 * @returns a response from the Sheets API containing the data
 */
export const getRange = async (target: string, range: string, major: MajorDimension = "ROWS") =>
    sheets.values.get({
        spreadsheetId: target,
        range: range,
        majorDimension: major,
    });

/**
 * Returns the data in a single column of `targetSheet` on page `sheetNumber` in column-major form
 * @param target the ID of the sheet to read data from
 * @param col a single letter, identifying the column read from
 * @param page an optional number, specifying the page number of the `target` to read from
 * @returns a string array of the data in column `col` of `target`'s page `page`
 */
export const getColumn = async (
    target: string,
    col: string,
    page: number = 1
): Promise<string[]> => {
    const range = buildRange(page, col, col);
    return (await getRange(target, range, "COLUMNS")).data.values![0];
};

/**
 * Returns the data in a single row of `target` on page `page` in row-major form
 * @param target the ID of the sheet to read data from
 * @param row a single number, identifying the row to get data from. First row is `1`.
 * @param page an optional number, specifying the page number of the `target` to read from
 * @returns a string array of the data in row `row` of `target`'s page `page`
 */
export const getRow = async (
    target: string,
    row: number | string,
    page: number = 1
): Promise<string[]> => {
    const range = buildRange(page, `${row}`, `${row}`);
    return (await getRange(target, range, "ROWS")).data.values![0];
};
