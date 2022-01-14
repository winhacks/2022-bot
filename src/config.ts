import {readFileSync} from "fs";
import {logger} from "./logger";

type ConfigType = {
    // shared config
    api_token: string;
    app_id: string;
    api_version: string;
    bot_uid: number;
    dev_mode: boolean;
    dev_guild: string;
    prod_guild: string;

    // Google Sheets API config
    sheets_api: {
        scopes: string[];
        private_key: string;
        client_email: string;
    };

    // MongoDB API config
    mongo_db: {
        database_url: string;
        certificate: string;
        private_key: string;
    };

    // verify command config
    verify: {
        registration_url: string;
        target_sheet: string;
        email_column: string;
        verified_role_name: string;
    };

    // teams command group config
    teams: {
        database_name: string;
        max_name_length: number;
        max_team_size: number;
        invite_duration: number;
        teams_per_category: number;
        category_base_name: string;
    };

    // info command config
    bot_info: {
        name: string;
        color: string;
        event_name: string;
        title_url?: string;
        thumbnail?: string;
        description: string;
        embedColor: number;
    };

    socials: {
        facebook?: string;
        twitter?: string;
        instagram?: string;
        linkedIn?: string;
    };
};

let Config: ConfigType;

const LoadConfig = (file: string) => {
    const data = readFileSync(file, "utf-8");
    Config = JSON.parse(data) as ConfigType;

    Config.bot_info.embedColor = Number.parseInt(Config.bot_info.color.slice(1), 16);

    logger.level = Config.dev_mode ? "debug" : "info";
    logger.debug(Config);
};

export {Config, LoadConfig, ConfigType};
