import {
    SlashCommandBuilder,
    SlashCommandStringOption,
    SlashCommandSubcommandBuilder,
    SlashCommandUserOption,
} from "@discordjs/builders";
import {CommandInteraction, CacheType} from "discord.js";
import {GenericError, SafeReply} from "../helpers/responses";
import {CommandType, TeamType} from "../types";
import {CreateTeam} from "./team/create";
import {TeamInfo} from "./team/info";
import {RenameTeam} from "./team/rename";
import {InviteToTeam} from "./team/invite";
import {LeaveTeam} from "./team/leave";
import {FindOne, teamCollection} from "../helpers/database";
import {NotInTeamResponse} from "./team/team-shared";

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
                .setDescription("Rename your team.")
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
    deferMode: "NO-DEFER",
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        const subcommand = intr.options.getSubcommand();

        // user wants to create a new team
        if (subcommand === "create") {
            return CreateTeam(intr);
        }

        // team should exist for the rest, so look it up
        const team = await FindOne<TeamType>(teamCollection, {members: intr.user.id});
        if (!team) {
            return SafeReply(intr, NotInTeamResponse(true));
        }

        // info/leave command can be used anywhere
        if (subcommand === "info") {
            return TeamInfo(intr, team);
        } else if (subcommand === "leave") {
            return LeaveTeam(intr, team);
        } else if (subcommand === "invite") {
            return InviteToTeam(intr, team);
        }

        // disabled because the module is broken
        // if (subcommand === "rename") {
        //     return RenameTeam(intr, team);
        // }

        return SafeReply(intr, GenericError());
    },
};

export {teamModule as command};
