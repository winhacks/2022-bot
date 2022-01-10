import {
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
} from "@discordjs/builders";
import {CacheType, Client, Collection, CommandInteraction} from "discord.js";

export interface CommandType {
    data:
        | SlashCommandBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | Omit<SlashCommandBuilder, "addSubcommandGroup" | "addSubcommand">;
    execute: (interaction: CommandInteraction<CacheType>) => Promise<any>;
}

export interface ClientType extends Client {
    commands: Collection<string, CommandType>;
}
