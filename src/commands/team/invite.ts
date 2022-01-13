import {hyperlink} from "@discordjs/builders";
import {
    CacheType,
    CommandInteraction,
    DiscordAPIError,
    Message,
    MessageActionRow,
    MessageButton,
    MessageComponentInteraction,
    MessageEmbed,
} from "discord.js";
import {MessageButtonStyles} from "discord.js/typings/enums";
import {Config} from "../../config";
import {FindOne, teamCollection, verifiedCollection} from "../../helpers/database";
import {RelativeTime} from "../../helpers/misc";
import {GenericError, NotVerifiedResponse, SafeReply} from "../../helpers/responses";
import {TeamType, VerifiedUserType} from "../../types";
import {
    GetInviteId,
    NotInGuildResponse,
    NotTeamLeaderResponse,
    ParseInviteId,
    TeamByMember,
    TeamByOwner,
    TeamFullResponse,
    VerifiedUserByID,
} from "./team-shared";

// TODO: finish this

export const InviteToTeam = async (intr: CommandInteraction<CacheType>): Promise<any> => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    }

    const user = intr.options.getUser("user", true);
    const userToInvite = intr.guild!.members.cache.find((usr) => usr.id === user.id)!;

    const team = await FindOne<TeamType>(teamCollection, TeamByOwner(intr.user.id));
    if (!team) {
        return SafeReply(intr, NotTeamLeaderResponse());
    }

    if (team.members.length + 1 >= Config.teams.max_team_size)
        return SafeReply(intr, TeamFullResponse());

    const verifiedUser = await FindOne<VerifiedUserType>(
        verifiedCollection,
        VerifiedUserByID(intr.user.id)
    );
    if (!verifiedUser) {
        return SafeReply(intr, NotVerifiedResponse());
    }

    // try sending the invite to the user's DM
    const inviteEmbed = new MessageEmbed()
        .setColor(Config.bot_info.embedColor)
        .setTitle(":partying_face: You've Been Invited")
        .setDescription(
            [
                `You've been invited to join Team ${team.name}'s noble quest to`,
                `be the best there ever was at ${Config.bot_info.event_name}.`,
                `This invite expires ${RelativeTime(new Date())}.`,
            ].join(" ")
        );

    const duration = Config.teams.invite_duration * 60_000;
    const acceptID = GetInviteId(team.stdName, "accept");
    const declineID = GetInviteId(team.stdName, "decline");
    const buttonRow = new MessageActionRow().addComponents(
        new MessageButton()
            .setStyle(MessageButtonStyles.SECONDARY)
            .setLabel("Decline")
            .setCustomId(declineID),
        new MessageButton()
            .setStyle(MessageButtonStyles.PRIMARY)
            .setLabel("Accept")
            .setCustomId(acceptID)
    );

    let message: Message;
    try {
        message = await userToInvite.send({
            embeds: [inviteEmbed],
            components: [buttonRow],
        });
    } catch (err) {
        // if we caught something that isn't an API error, or is not code
        // 50007 (user not accepting DMs), throw generic error
        if (!(err instanceof DiscordAPIError) || err.httpStatus != 403) {
            return SafeReply(intr, GenericError());
        }

        // cannot send DMs to this user, report that failure
        return SafeReply(intr, {
            ephemeral: true,
            embeds: [
                new MessageEmbed()
                    .setColor(Config.bot_info.embedColor)
                    .setTitle(":x: Cannot Invite User")
                    .setDescription(
                        `This user is not allowing DMs from this server. Ask them to temporarily ${hyperlink(
                            "enable them",
                            "https://support.discord.com/hc/en-us/articles/217916488-Blocking-Privacy-Settings-"
                        )}, then try again.`
                    ),
            ],
        });
    }

    if (!user.dmChannel) {
        return SafeReply(intr, GenericError());
    }

    const eventFilter = (i: MessageComponentInteraction<"cached">) =>
        i.customId === acceptID || i.customId === declineID;

    const eventCollector = user.dmChannel.createMessageComponentCollector({
        filter: eventFilter,
        time: duration,
    });

    eventCollector.on("collect", OnCollectorCollect);
    eventCollector.on("end", () => {
        HandleMessageExpiration(message, team);
    });

    return SafeReply(intr, {
        embeds: [
            new MessageEmbed()
                .setColor(Config.bot_info.embedColor)
                .setTitle(":white_check_mark: Invite Sent")
                .setDescription(`${userToInvite.displayName} has been invited.`),
        ],
    });
};

const OnCollectorCollect = async (intr: MessageComponentInteraction<CacheType>) => {
    const {action} = ParseInviteId(intr.customId);

    if (action === "accept") {
        await HandleOfferAccept(intr);
    } else {
        await HandleOfferDecline(intr);
    }

    intr.deferUpdate();
};

const HandleOfferAccept = async (intr: MessageComponentInteraction<CacheType>) => {
    const {teamName} = ParseInviteId(intr.customId);
    const existingTeam = await FindOne<TeamType>(
        teamCollection,
        TeamByMember(intr.user.id, true)
    );

    let response;
    if (existingTeam) {
        response = new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(":x: You Can't Join Another Team")
            .setDescription(
                [
                    "Sorry, you're only allowed to be in one team at a time.",
                    "You can leave your current team with `/team leave`.",
                ].join(" ")
            );
    } else {
        response = new MessageEmbed()
            .setColor(Config.bot_info.embedColor)
            .setTitle(`:partying_face: You're now a member of Team ${teamName}`)
            .setDescription(`You accepted the invite ${RelativeTime(new Date())}.`);
    }
    return (intr.message as Message<boolean>).edit({
        embeds: [response],
        components: [],
    });
};

const HandleOfferDecline = async (intr: MessageComponentInteraction<CacheType>) => {
    const {teamName} = ParseInviteId(intr.customId);
    const response = new MessageEmbed()
        .setColor(Config.bot_info.embedColor)
        .setTitle(":confused: Invite Declined")
        .setDescription(
            `You declined to join Team ${teamName} ${RelativeTime(new Date())}.`
        );
    return await (intr.message as Message<boolean>).edit({
        embeds: [response],
        components: [],
    });
};

const HandleMessageExpiration = (msg: Message, team: TeamType) => {
    const expired = new MessageEmbed()
        .setColor(Config.bot_info.embedColor)
        .setTitle(":confused: Invite Expired")
        .setDescription(
            `Your invite to join ${team.name} expired ${RelativeTime(
                new Date()
            )}. You can ask the team leader for another.`
        );
    msg.edit({embeds: [expired], components: []});
};
