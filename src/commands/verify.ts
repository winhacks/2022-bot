import {SlashCommandBuilder, SlashCommandStringOption} from "@discordjs/builders";
import {
    CacheType,
    Collection,
    CommandInteraction,
    GuildMemberRoleManager,
    MessageEmbed,
} from "discord.js";
import {Config} from "../config";
import {InsertOne, verifiedCollection} from "../helpers/database";
import {GetDefault} from "../helpers/misc";
import {GenericError, SafeReply} from "../helpers/responses";
import {GetColumn, GetRow} from "../helpers/sheetsAPI";
import {logger} from "../logger";
import {CardInfoType, CommandType, VerifiedUserType} from "../types";

// source: https://www.emailregex.com/ (apparently 99.99% accurate)
const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

let verifyCache: Collection<string, boolean> = new Collection<string, boolean>();

const verifyModule: CommandType = {
    data: new SlashCommandBuilder() //
        .setName("verify")
        .setDescription("Verify yourself.")
        .addStringOption(
            new SlashCommandStringOption()
                .setName("email")
                .setDescription("The email you registered with")
                .setRequired(true)
        ),
    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        // ensure in guild
        if (!intr.inGuild()) {
            return SafeReply(intr, ":x: This command can only be used in servers.");
        }

        // ensure valid email is entered
        const email = intr.options.getString("email", true);
        if (!email.match(emailRegex)) {
            return SafeReply(intr, "That doesn't appear to be a valid email address.");
        }

        // get data from sheets API
        const emailColumn = await GetColumn(
            Config.verify.target_sheet,
            Config.verify.email_column
        );
        let emailIndex = emailColumn.indexOf(email);

        // check cache & update if needed. Short-circuit if user is already verified.
        let verified: boolean = GetDefault(verifyCache, email, false);
        if (verified) {
            const alreadyVerified = new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":fire: Already Verified")
                .setDescription("You're already verified.");
            return SafeReply(intr, {embeds: [alreadyVerified]});
        } else {
            verified = emailIndex !== -1;
            verifyCache.set(email, verified);
        }

        // handle verification result
        if (verified) {
            const userData = await GetRow(Config.verify.target_sheet, 1 + emailIndex);
            const result = await VerifyUser(intr, email, userData);
            if (!result) {
                return SafeReply(intr, GenericError());
            }

            logger.info(`Verified ${intr.user.username} with email ${email}`);
            return SafeReply(intr, "Successfully verified!");
        } else {
            return SafeReply(intr, "Sorry, I couldn't verify that email address.");
        }
    },
};

const VerifyUser = async (
    intr: CommandInteraction<CacheType>,
    email: string,
    userData: string[]
): Promise<boolean> => {
    // TODO: extract information from userData

    const verifiedUser: VerifiedUserType = {
        userID: intr.user.id,
        verifiedAt: new Date().getTime(),
        email: email,
        infoCollectionConsent: false,
    };

    return InsertOne<VerifiedUserType>(verifiedCollection, verifiedUser);
};

export {verifyModule as command};
