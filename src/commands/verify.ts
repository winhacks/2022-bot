import {roleMention} from "@discordjs/builders";
import {CacheType, CommandInteraction, GuildMemberRoleManager} from "discord.js";
import {Config} from "../config";
import {NamedCommand, StringOption} from "../helpers/commands";
import {safeReply} from "../helpers/responses";
import {getColumn} from "../helpers/sheetsAPI";
import {logger} from "../logger";
import {CommandType} from "../types";

// source: https://www.emailregex.com/ (apparently 99.99% accurate)
const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

let emailCache: string[] | undefined = undefined;

const verifyModule: CommandType = {
    data: NamedCommand("verify", "Verify yourself.").addStringOption(
        StringOption("email", "The email you registered with", true)
    ),
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        await intr.deferReply();

        // ensure in guild
        if (!intr.inGuild()) {
            return safeReply(intr, ":x: This command can only be used in servers.");
        }

        // ensure valid email is entered
        const email = intr.options.getString("email")!;
        if (!email.match(emailRegex)) {
            return safeReply(intr, "That doesn't appear to be a valid email address.");
        }

        // check cache & update if needed
        let verified = emailCache?.includes(email);
        if (!verified || !emailCache) {
            emailCache = await getColumn(Config.verify.target_sheet, Config.verify.email_column);
            verified = emailCache?.includes(email);
        }

        // handle verification result
        if (verified) {
            // handle verified
            const role = intr.guild!.roles.cache.findKey(
                (role) => role.name === Config.verify.verified_role_name
            );

            if (!role) throw new Error("Undefined verified role name. This is not permitted!");

            const memberRoles = intr.member.roles;
            if (memberRoles instanceof GuildMemberRoleManager) {
                memberRoles.add(role);
            } else {
                memberRoles.push(role);
            }

            logger.info(`Verified ${intr.user.username} with email ${email}`);
            return safeReply(intr, "Successfully verified!");
        } else {
            // handle verification failed
            return safeReply(intr, "Sorry, I couldn't verify that email address.");
        }
    },
};

export {verifyModule as command};
