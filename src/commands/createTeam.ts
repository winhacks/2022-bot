import {channel} from "diagnostics_channel";
import {CacheType, CommandInteraction, GuildMember, Interaction, TextChannel} from "discord.js";
import {Config} from "../config";
import {NamedCommand, StringOption} from "../helpers/commands";
import {safeReply, SimpleTextEmbed} from "../helpers/responses";
import {createTeam, CreateTeamResult} from "../helpers/teams";
import {CommandType} from "../types";

const characterMatch = /^[A-Za-z0-9 \-]+$/;
const hyphenFormatMatch = /^(?:[A-Za-z0-9]+-?[A-Za-z0-9]+)+$/;

const teamNameErr = ":x: Invalid Team Name";
const createErr = ":x: Unable To Create Team";

const createTeamModule: CommandType = {
    data: NamedCommand("createteam", "Create a new team").addStringOption(
        StringOption("name", "The name of your team", true)
    ),
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        await intr.deferReply();

        const teamName = intr.options.getString("name")!.trim().replace(/\s\s+/, " ") as string;
        const channelName = teamName.replace(/\s/, "-");

        console.log(teamName);
        console.log(channelName);

        // ensure not a stupid long name
        if (teamName.length > Config.teams.max_name_length)
            return safeReply(intr, {
                embeds: [SimpleTextEmbed(teamNameErr, "Provided team name is too long.")],
            });

        // ensure only english alphanumerics, spaces, and hyphens
        if (!teamName.match(characterMatch))
            return safeReply(intr, {
                embeds: [
                    SimpleTextEmbed(
                        teamNameErr,
                        "Only spaces, hyphens, and English alphanumeric characters are allowed."
                    ),
                ],
            });

        // ensure channel name will be valid
        if (!channelName.match(hyphenFormatMatch))
            return safeReply(intr, {
                // TODO: add fields here
                embeds: [
                    SimpleTextEmbed(
                        teamNameErr,
                        "Spaces and hyphens must have English alphanumeric characters on both sides."
                    ),
                ],
            });

        const result = await createTeam(teamName, intr.member as GuildMember);
        switch (result) {
            case "ALREADY_OWN_TEAM":
                return safeReply(intr, {
                    embeds: [SimpleTextEmbed(createErr, "It looks like you already own a team.")],
                });
            case "NAME_EXISTS":
                return safeReply(intr, {
                    embeds: [SimpleTextEmbed(createErr, "A team with that name already exists.")],
                });
            case "FAILURE":
                return safeReply(intr, {
                    embeds: [
                        SimpleTextEmbed(
                            createErr,
                            "An unknown error occurred while creating your team."
                        ),
                    ],
                });
        }

        if (!intr.guild)
            return safeReply(intr, {
                embeds: [SimpleTextEmbed(createErr, "Can only create teams in servers.")],
            });

        const everyoneID = intr.guild.roles.cache.findKey((role) => role.name === "@everyone")!;
        intr.guild?.channels.create(channelName, {
            type: "GUILD_TEXT",
            permissionOverwrites: [
                {
                    id: everyoneID,
                    deny: ["VIEW_CHANNEL", "CREATE_INSTANT_INVITE"],
                },
                {
                    id: intr.user.id,
                    allow: ["VIEW_CHANNEL", "CREATE_INSTANT_INVITE"],
                },
            ],
        });

        intr.guild?.channels.create(channelName + "-voice", {
            type: "GUILD_VOICE",
            permissionOverwrites: [
                {
                    id: everyoneID,
                    deny: ["VIEW_CHANNEL", "CONNECT", "SPEAK", "CREATE_INSTANT_INVITE"],
                },
                {
                    id: intr.user.id,
                    allow: ["VIEW_CHANNEL", "CONNECT", "SPEAK"],
                },
            ],
        });

        // success
        return safeReply(intr, {
            embeds: [
                SimpleTextEmbed(
                    "Success :partying_face:",
                    `Team **${teamName}** has been created. Your private channels are #${teamName} and ${teamName}-voice. Invite people with \`/invite\`.`
                ),
            ],
        });
    },
};

export {createTeamModule as command};
