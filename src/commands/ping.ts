import {SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {ResponseEmbed, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";

// FINISHED

const pingModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("ping")
        .setDescription("Ping. Pong?"),
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>) => {
        let uptime = intr.client.uptime!;
        const ms = uptime % 1000;
        const secs = (uptime = Math.floor(uptime / 1000)) % 60;
        const mins = (uptime = Math.floor(uptime / 60)) % 60;
        const hours = (uptime = Math.floor(uptime / 60)) % 24;
        const days = Math.floor(uptime / 24);

        const msStr = ms !== 0 ? `${ms} ms` : "";
        const secsStr = secs !== 0 ? `${secs}s, ` : "";
        const minsStr = mins !== 0 ? `${mins}m, ` : "";
        const hoursStr = hours !== 0 ? `${hours}h, ` : "";
        const daysStr = days !== 0 ? `${days}d, ` : "";

        return SafeReply(intr, {
            ephemeral: true,
            embeds: [
                ResponseEmbed()
                    .setTitle("Pong!")
                    .addField("Ping:", `${intr.client.ws.ping}ms`, true)
                    .addField(
                        "Uptime:",
                        `${daysStr}${hoursStr}${minsStr}${secsStr}${msStr}`,
                        true
                    ),
            ],
        });
    },
};

export {pingModule as command};
