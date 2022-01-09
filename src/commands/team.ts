import {SlashCommandBuilder, SlashCommandSubcommandBuilder} from "@discordjs/builders";
import {CommandInteraction, CacheType, Guild, OverwriteResolvable} from "discord.js";
import {Config} from "../config";
import {StringOption} from "../helpers/commands";
import {safeReply, SimpleTextEmbed} from "../helpers/responses";
import {CommandType} from "../types";
import {createTeam} from "./team/create";
import {teamInfo} from "./team/info";

type SanitizeResult = "INVALID_CHARS" | "TOO_LONG" | "REPEATED_CHARS" | "VALID";

export const teamNameErr = ":x: Invalid Team Name";
export const createErr = ":x: Unable To Create Team";

const renameTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    return safeReply(intr, "Rename team");
};

const buildTeamPermissions = (guild: Guild, members: string[]): OverwriteResolvable[] => {
    const everyoneID = guild.roles.cache.findKey((role) => role.name === "@everyone");
    if (!everyoneID) throw new Error(`Somehow the @everyone role isn't cached for ${guild.id}`);

    const teamPerms: OverwriteResolvable[] = [
        {
            id: everyoneID,
            deny: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "SEND_MESSAGES", "CREATE_INSTANT_INVITE"],
        },
    ];

    members.forEach((memberId) =>
        teamPerms.push({id: memberId, allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "SEND_MESSAGES"]})
    );

    return teamPerms;
};

export const makeTeamChannels = async (
    guild: Guild,
    teamName: string,
    members: string[]
): Promise<[string, string]> => {
    const teamPerms = buildTeamPermissions(guild, members);
    const textId = (
        await guild.channels.create(teamName, {
            type: "GUILD_TEXT",
            permissionOverwrites: teamPerms,
        })
    ).id;

    const voiceId = (
        await guild.channels.create(teamName + "-voice", {
            type: "GUILD_VOICE",
            permissionOverwrites: teamPerms,
        })
    ).id;

    return [textId, voiceId];
};

export const validateTeamName = (rawName: string): SanitizeResult => {
    const hyphenated = rawName.replaceAll(" ", "-");

    if (rawName.length > Config.teams.max_name_length) return "TOO_LONG";
    if (!rawName.match(/^[a-z0-9\-]+$/)) return "INVALID_CHARS";
    if (!hyphenated.match(/^(?:[a-z0-9]+-?[a-z0-9]+)+$/)) return "REPEATED_CHARS";

    return "VALID";
};

const teamModule: CommandType = {
    data: new SlashCommandBuilder()
        .setName("team")
        .setDescription("test")
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("create")
                .setDescription("Create a new team.")
                .addStringOption(StringOption("name", "Name of the team to create", true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("rename")
                .setDescription("Rename your team. You must be the team leader.")
                .addStringOption(StringOption("name", "The new name for your team", true))
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("info")
                .setDescription("See information about the team you're currently in.")
        ),
    execute: async (interaction: CommandInteraction<CacheType>): Promise<any> => {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") return createTeam(interaction);
        if (subcommand === "rename") return renameTeam(interaction);
        if (subcommand === "info") return teamInfo(interaction);

        return safeReply(interaction, {
            embeds: [
                SimpleTextEmbed(
                    ":x: Invalid command",
                    "You've somehow requested an invalid command. Congrats, I guess."
                ),
            ],
        });
    },
};

export {teamModule as command};
