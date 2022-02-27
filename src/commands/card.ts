import {hyperlink, SlashCommandBuilder} from "@discordjs/builders";
import {
    CacheType,
    Collection,
    CommandInteraction,
    MessageAttachment,
    User,
} from "discord.js";
import {Config} from "../config";
import {FindOne, verifiedCollection} from "../helpers/database";
import {NotVerifiedResponse, ResponseEmbed, SafeReply} from "../helpers/responses";
import {CardInfoType, CommandType, VerifiedUserType} from "../types";
import {readFileSync} from "fs";
import nodeHtmlToImage from "node-html-to-image";
import {PrettyUser} from "../helpers/misc";

// load required images and fonts
const badgeFiles = new Collection<string, string>();
const logoFiles = new Collection<string, string>();

const card: CommandType = {
    data: new SlashCommandBuilder()
        .setName("card")
        .setDescription("Show off your business card!"),
    ephemeral: false,

    execute: async (intr: CommandInteraction<CacheType>): Promise<any> => {
        const userInfo = await FindOne<VerifiedUserType>(verifiedCollection, {
            userID: intr.user.id,
        });
        if (!userInfo) {
            return SafeReply(intr, NotVerifiedResponse());
        }

        if (!userInfo.cardInfo || !userInfo.cardInfo.authorizedCard) {
            const reply = ResponseEmbed()
                .setTitle(":x: Can't Generate Card")
                .setDescription(
                    [
                        "You didn't authorize us to generate a card for you. If you'd",
                        "like to consent, you can re-register",
                        `${hyperlink("here", Config.verify.registration_url)}. Make sure`,
                        "you select 'yes' when asked about using your application's information",
                        "to generate a 'card'.",
                    ].join(" ")
                );
            return SafeReply(intr, {embeds: [reply]});
        }

        // verified, we have their info, and they did consent. Generate the card.
        const cardDataBuffer = await MakeCard(userInfo.cardInfo, intr.user);
        const imageAttachment = new MessageAttachment(cardDataBuffer);
        return SafeReply(intr, {files: [imageAttachment]});
    },
};

const MakeCard = (userInfo: CardInfoType, user: User): Promise<Buffer> => {
    const html = readFileSync("./src/static/card/layout.html").toString();
    return nodeHtmlToImage({
        html: html,
        selector: "#viewport",
        content: {
            name: `${userInfo.firstName} ${userInfo.lastName}`,
            discordName: PrettyUser(user),
            studyArea: userInfo.studyArea ?? "",
            studyLocation: userInfo.studyLocation ?? "",
            pronouns: userInfo.pronouns,
            pfpURL: user.displayAvatarURL({format: "png", size: 256}),
            badgeURL: `logos/windsor/badge.png`,
            logoURL: `logos/windsor/badge.png`,
            description: userInfo.customDescription ?? "",
        },
    }) as Promise<Buffer>;
};

export {card as command};
