import {SlashCommandBooleanOption, SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction} from "discord.js";
import {ResponseEmbed, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";
import {freemem, totalmem} from "os";
import {currentLoad} from "systeminformation";

const pingModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("ping")
        .setDescription("Ping. Pong?")
        .addBooleanOption(
            new SlashCommandBooleanOption()
                .setName("detailed")
                .setDescription("Show extended statistics")
                .setRequired(false)
        )
        .addBooleanOption(
            new SlashCommandBooleanOption()
                .setName("ephemeral")
                .setDescription("When false, statistics will be visible to everyone")
                .setRequired(false)
        ),
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>) => {
        let uptime = intr.client.uptime!;
        const ms = uptime % 1000;
        const secs = (uptime = Math.floor(uptime / 1000)) % 60;
        const mins = (uptime = Math.floor(uptime / 60)) % 60;
        const hours = (uptime = Math.floor(uptime / 60)) % 24;
        const days = Math.floor(uptime / 24);

        const msStr = ms ? `${ms} ms` : "";
        const secStr = secs ? `${secs}s, ` : "";
        const minStr = mins ? `${mins}m, ` : "";
        const hrStr = hours ? `${hours}h, ` : "";
        const dayStr = days ? `${days}d, ` : "";

        const embed = ResponseEmbed().setTitle("Pong!");

        embed.addField("Ping", `${intr.client.ws.ping}ms`, true);
        embed.addField("Uptime", `${dayStr}${hrStr}${minStr}${secStr}${msStr}`, true);

        if (intr.options.getBoolean("detailed")) {
            const bytesToMB = 1 / (1000 * 1000);

            const freeMB = Math.ceil(freemem() * bytesToMB);
            const totalMB = Math.ceil(totalmem() * bytesToMB);
            const usedMB = totalMB - freeMB;

            const cpuPercent = Math.ceil((await currentLoad()).currentLoad);

            embed.addField("CPU Usage:", `${cpuPercent}%`);
            embed.addField("Memory Usage:", `${usedMB} of ${totalMB} MB`, true);
        }

        return SafeReply(intr, {
            ephemeral: intr.options.getBoolean("ephemeral") ?? true,
            embeds: [embed],
        });
    },
};

export {pingModule as command};
