import {SlashCommandBuilder, SlashCommandStringOption} from "@discordjs/builders";

export const NamedCommand = (name: string, description: string) => {
    return new SlashCommandBuilder().setName(name).setDescription(description);
};

export const StringOption = (name: string, description: string, required: boolean = false) => {
    return new SlashCommandStringOption()
        .setName(name)
        .setDescription(description)
        .setRequired(required);
};
