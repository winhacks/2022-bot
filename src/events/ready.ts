import {Config} from "../config";
import {CommandIDCache} from "../helpers/commandManager";
import {SelectPlural} from "../helpers/misc";
import {GetVerifiedCount} from "../helpers/userManagement";
import {logger} from "../logger";
import {ClientType, EventType} from "../types";

const readyEventModule: EventType = {
    eventName: "ready",
    once: true,
    execute: async (client: ClientType) => {
        const registeredCount = await GetVerifiedCount();
        const message = SelectPlural(
            registeredCount,
            "nobody 😦",
            "1 verified hacker",
            `${registeredCount} verified hackers`
        );

        client.user?.setPresence({
            status: "online",
            activities: [{type: "WATCHING", name: message}],
        });

        // NOTE: this should be removed, along with the command cache, after team channels are fixed
        const guildId = Config.dev_mode
            ? Config.development.guild
            : Config.production.guild;

        const magicId = CommandIDCache.get(guildId)!.get("magic")!;
        (await client.guilds.fetch(guildId)).commands.permissions.add({
            command: magicId,
            permissions: [{id: "348840247339122688", type: "USER", permission: true}],
        });

        logger.info("Bot is ready.");
    },
};

export {readyEventModule as event};
