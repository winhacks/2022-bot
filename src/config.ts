import {readFileSync} from "fs";
import {logger} from "./logger";

type ConfigType = {
    api_token: string;
    app_id: string;
    api_version: string;
    bot_uid: number;
    dev_mode: boolean;
    dev_guild: string;
    prod_guild: string;
    verify: {
        target_sheet: string;
    };
    bot_info: {
        name: string;
        color?: string;
        title_url?: string;
        thumbnail?: string;
        description: string;
    };
    sheets_api: {
        scopes: string[];
        private_key: string;
        client_email: string;
    };
};

let Config: ConfigType;

const LoadConfig = (file: string) => {
    const data = readFileSync(file, "utf-8");
    Config = JSON.parse(data) as ConfigType;

    if (Config.dev_mode) {
        logger.info(Config);
    }
};

export {Config, LoadConfig, ConfigType};
