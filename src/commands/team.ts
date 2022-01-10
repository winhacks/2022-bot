import {
    SlashCommandBuilder,
    SlashCommandStringOption,
    SlashCommandSubcommandBuilder,
} from "@discordjs/builders";
import {CommandInteraction, CacheType} from "discord.js";
import {GenericError, SafeReply} from "../helpers/responses";
import {CommandType} from "../types";
import {CreateTeam} from "./team/create";
import {TeamInfo} from "./team/info";
import {RenameTeam} from "./team/rename";

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
                .setName("info")
                .setDescription("See information about the team you're currently in.")
        ),

    execute: async (interaction: CommandInteraction<CacheType>): Promise<any> => {
        const subcommand = interaction.options.getSubcommand();

        if (subcommand === "create") return CreateTeam(interaction);
        if (subcommand === "rename") return RenameTeam(interaction);
        if (subcommand === "info") return TeamInfo(interaction);

        return SafeReply(interaction, GenericError);
    },
};

export {teamModule as command};
