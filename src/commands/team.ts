import {
    SlashCommandBuilder,
    SlashCommandStringOption,
    SlashCommandSubcommandBuilder,
    SlashCommandUserOption,
} from "@discordjs/builders";
import {CommandInteraction, CacheType} from "discord.js";
import {GenericError, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";
import {CreateTeam} from "./team/create";
import {TeamInfo} from "./team/info";
import {RenameTeam} from "./team/rename";
import {InviteToTeam} from "./team/invite";
import {LeaveTeam} from "./team/leave";

// FINISHED

const teamModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("team")
        .setDescription("test")
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("create")
                .setDescription("Create a new team.")
                .addStringOption(
                    new SlashCommandStringOption()
                        .setName("name")
                        .setDescription("Name of the team to create")
                        .setRequired(true)
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("rename")
                .setDescription("Rename your team. You must be the team leader.")
                .addStringOption(
                    new SlashCommandStringOption()
                        .setName("name")
                        .setDescription("The new name for your team")
                        .setRequired(true)
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("invite")
                .setDescription("Invite a user to your team.")
                .addUserOption(
                    new SlashCommandUserOption()
                        .setName("user")
                        .setDescription("The user to invite")
                        .setRequired(true)
                )
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("info")
                .setDescription("See information about the team you're currently in.")
        )
        .addSubcommand(
            new SlashCommandSubcommandBuilder()
                .setName("leave")
                .setDescription("Leave your current team.")
        ),
    ephemeral: true,

    execute: async (interaction: CommandInteraction<CacheType>): Promise<any> => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") {
            return CreateTeam(interaction);
        } else if (subcommand === "rename") {
            return RenameTeam(interaction);
        } else if (subcommand === "invite") {
            return InviteToTeam(interaction);
        } else if (subcommand === "info") {
            return TeamInfo(interaction);
        } else if (subcommand === "leave") {
            return LeaveTeam(interaction);
        }

        return SafeReply(interaction, GenericError());
    },
};

export {teamModule as command};
