import {SlashCommandBuilder} from "@discordjs/builders";
import {
    CacheType,
    CommandInteraction,
    DiscordAPIError,
    Guild,
    RateLimitError,
} from "discord.js";
import {GetClient, teamCollection} from "../helpers/database";
import {ErrorMessage, SafeReply, SuccessMessage} from "../helpers/responses";
import {logger} from "../logger";
import {CommandType, TeamType} from "../types";
import {MakeTeamPermissions} from "./team/team-shared";

const resetPermissionsModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("magic")
        .setDefaultPermission(false)
        .setDescription("Admin only. Patches team channel permissions to use new system"),
    deferMode: "EPHEMERAL",
    execute: async (intr: CommandInteraction<CacheType>) => {
        if (!intr.inCachedGuild()) {
            return SafeReply(intr, ErrorMessage({message: "Not in a cached guild!"}));
        }

        const client = await GetClient<TeamType>(teamCollection);
        const allTeams = client.find();

        let team;
        while ((team = await allTeams.next()) !== null) {
            logger.info(`Now fixing ${team.name}...`);
            let timeout = 0;
            while ((timeout = await FixPermissions(intr.guild!, team)) !== -1) {
                logger.warn(`Failed with code ${timeout}, retrying in ${timeout + 100}`);
                await new Promise((resolve) => setTimeout(resolve, timeout + 100));
            }
        }

        return SafeReply(
            intr,
            SuccessMessage({message: "All channels should now be fixed :)"})
        );
    },
};

const FixPermissions = async (guild: Guild, team: TeamType) => {
    const [voice, text] = await Promise.all([
        guild.channels.fetch(team.voiceChannel),
        guild.channels.fetch(team.textChannel),
    ]);

    const channelPermsCorrection = MakeTeamPermissions(guild, team.name, team.members);

    try {
        await Promise.all([
            voice?.permissionOverwrites.set(channelPermsCorrection),
            text?.permissionOverwrites.set(channelPermsCorrection),
        ]);
    } catch (e) {
        const error = e as DiscordAPIError & RateLimitError;
        if (error.code !== 4008) {
            return 0; // try again
        }

        return error.timeout;
    }

    return -1; // ths request was OK
};

export {resetPermissionsModule as command};
