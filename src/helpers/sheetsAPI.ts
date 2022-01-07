import {Credentials} from "google-auth-library";
import {google} from "googleapis";
import {Config} from "../config";

let cachedCredentials: Credentials | undefined = undefined;

/** Returns a valid set of credentials for use with any API in `Config.sheets_api.scopes` */
export const getCredentials = async () => {
    // cached creds are still valid
    if (!cachedCredentials || !(cachedCredentials.expiry_date! >= new Date().getTime())) {
        cachedCredentials = await new google.auth.JWT({
            email: Config.sheets_api.client_email,
            key: Config.sheets_api.private_key,
            scopes: Config.sheets_api.scopes,
        }).authorize();
    }

    return cachedCredentials;
};
