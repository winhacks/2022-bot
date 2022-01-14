import {
    hyperlink,
    SlashCommandBuilder,
    SlashCommandStringOption,
} from "@discordjs/builders";
import {CacheType, Collection, CommandInteraction, MessageEmbed} from "discord.js";
import {Config} from "../config";
import {InsertOne, verifiedCollection} from "../helpers/database";
import {GetDefault} from "../helpers/misc";
import {
    GenericError,
    ResponseEmbed,
    SafeReply,
    SuccessResponse,
} from "../helpers/responses";
import {GetColumn, GetRow} from "../helpers/sheetsAPI";
import {logger} from "../logger";
import {CardInfoType, CommandType, VerifiedUserType} from "../types";
import {NotInGuildResponse} from "./team/team-shared";

// source: https://www.emailregex.com/ (apparently 99.99% accurate)
const emailRegex =
    /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;

let verifyCache: Collection<string, boolean> = new Collection<string, boolean>();

// TODO: store user data in database, provided they give consent

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
        const email = intr.options.getString("email", true);

        if (!intr.inGuild()) {
            return SafeReply(intr, NotInGuildResponse());
        } else if (!email.match(emailRegex)) {
            return SafeReply(intr, {
                embeds: [
                    ResponseEmbed()
                        .setTitle(":x: Invalid Email")
                        .setDescription(
                            "That doesn't appear to be a valid email address."
                        ),
                ],
            });
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
            const alreadyVerified = ResponseEmbed()
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
            return SafeReply(intr, SuccessResponse("You are now verified."));
        } else {
            return SafeReply(intr, {
                embeds: [
                    ResponseEmbed()
                        .setTitle(":x: Verification Failed")
                        .setDescription(
                            `I couldn't verify that email address. If you haven't registered, you can ${hyperlink(
                                "register here",
                                Config.verify.registration_url
                            )}.`
                        ),
                ],
            });
        }
    },
};

const VerifyUser = async (
    intr: CommandInteraction<CacheType>,
    email: string,
    userData: string[]
): Promise<boolean> => {
    const verifiedUser: VerifiedUserType = {
        userID: intr.user.id,
        verifiedAt: Date.now(),
        email: email,
        infoCollectionConsent: false,
    };

    return InsertOne<VerifiedUserType>(verifiedCollection, verifiedUser);
};

export {verifyModule as command};
