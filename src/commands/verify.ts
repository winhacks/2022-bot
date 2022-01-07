import {CacheType, CommandInteraction} from "discord.js";
import {NamedCommand, StringOption} from "../helpers/commands";
import {CommandType} from "../types";

// source: https://www.emailregex.com/ (apparently 99.99% accurate)
const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

const verifyModule: CommandType = {
    data: NamedCommand("verify", "Verify yourself.").addStringOption(
        StringOption("email", "The email you registered with", true)
    ),
    execute: function (interaction: CommandInteraction<CacheType>): Promise<any> {
        const email = interaction.options.getString("email")!;
        if (!email.match(emailRegex)) {
            return interaction.reply("That doesn't appear to be a valid email address.");
        }

        return interaction.reply("Not implemented!");
    },
};

export {verifyModule as command};
