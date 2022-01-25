import {REST} from "@discordjs/rest";
import {Routes} from "discord-api-types/v9";
import {Collection} from "discord.js";
import {logger} from "../logger";
import {CommandType} from "../types";

/** Maps a Guild onto a map from name to ID (global commands are in the "global" guild) */
export const CommandIDCache = new Collection<string, Collection<string, string>>();

export const RegisterCommands = async (
    commands: CommandType[],
    guildId: string = "global",
    apiToken: string,
    appID: string,
    apiVersion: string = "9"
): Promise<number> => {
    const rest = new REST({version: apiVersion}).setToken(apiToken);
    const route =
        guildId === "global"
            ? Routes.applicationCommands(appID)
            : Routes.applicationGuildCommands(appID, guildId);

    const cmdArr = commands.map((command) => command.data.toJSON());
    const response = (await rest.put(route, {body: cmdArr})) as {
        id: string;
        name: string;
    }[];

    let guildCache = CommandIDCache.get(guildId);
    if (!guildCache) {
        guildCache = new Collection<string, string>();
        CommandIDCache.set(guildId, guildCache);
    }

    for (const registered of response) {
        guildCache.set(registered.name, registered.id);
    }

    logger.info(`Registered ${response.length} commands for guild ${guildId}`);
    return response.length;
};
