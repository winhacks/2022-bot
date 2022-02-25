import {hyperlink, SlashCommandBuilder} from "@discordjs/builders";
import {CacheType, CommandInteraction, MessageAttachment, User} from "discord.js";
import {Config} from "../config";
import {FindOne, verifiedCollection} from "../helpers/database";
import {NotVerifiedResponse, ResponseEmbed, SafeReply} from "../helpers/responses";
import {CardInfoType, CommandType, VerifiedUserType} from "../types";
import {createCanvas, loadImage, registerFont} from "canvas";
import {PrettyUser} from "../helpers/misc";

// load required images and fonts
const backgroundImage = loadImage("src/static/card/background.png");
registerFont("src/static/card/Roboto-Regular.ttf", {family: "Roboto"});
registerFont("src/static/card/Roboto-Bold.ttf", {family: "Roboto", weight: "bold"});

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
        return SafeReply(intr, {
            files: [imageAttachment],
        });
    },
};

const MakeCard = async (userInfo: CardInfoType, user: User): Promise<Buffer> => {
    const WIDTH = 1050;
    const HEIGHT = 600;

    const canvas = createCanvas(WIDTH, HEIGHT);
    const context = canvas.getContext("2d");

    // background template
    const bg = await backgroundImage;
    context.drawImage(bg, 0, 0, WIDTH, HEIGHT);

    // user pfp
    const pad = 12;
    const userIcon = await loadImage(user.displayAvatarURL({size: 256, format: "png"}));
    context.drawImage(userIcon, 779 + pad, 60 + pad, 212 - 2 * pad, 211 - 2 * pad);

    const tMargin = 90;
    const bMargin = 90;
    const lMargin = 50;

    // pronouns
    const pronounsFontSize = 32;
    context.font = `${pronounsFontSize}px Roboto`; // font style
    context.fillStyle = Config.bot_info.color; // font color
    context.textAlign = "center";
    context.fillText(userInfo.pronouns, 885, 278 + pronounsFontSize);

    // name & aka
    const nameSize = 70;
    const akaSize = 32;
    const rowWidth = 660 - lMargin;
    const name = `${userInfo.firstName} ${userInfo.lastName}`.toUpperCase();
    const aka = `AKA: ${PrettyUser(user).toUpperCase()}`;

    context.textAlign = "left";
    context.font = `${nameSize}px Roboto`;
    context.fillStyle = Config.bot_info.color;
    context.fillText(name, lMargin, tMargin + nameSize, rowWidth);
    context.font = `${akaSize}px Roboto`;
    context.fillStyle = "white";
    context.fillText(aka, lMargin, tMargin + nameSize + 10 + akaSize, rowWidth);

    // location & area of study
    if (userInfo.studyLocation && userInfo.studyArea) {
        userInfo.studyArea = "electrical and computer engineering";
        const locationSize = 54;
        const studyAreaSize = 36;
        const studyArea = `${userInfo.studyArea.toUpperCase()} AT`;
        const location = userInfo.studyLocation.toUpperCase();

        let yActual = HEIGHT - bMargin - locationSize - 5;
        context.font = `${studyAreaSize}px Roboto`;
        context.fillText(studyArea, lMargin, yActual, rowWidth);

        context.fillStyle = Config.bot_info.color;
        context.font = `${locationSize}px Roboto`;
        context.fillText(location, lMargin, HEIGHT - bMargin, rowWidth);
    }

    return canvas.toBuffer();
};

export {card as command};
