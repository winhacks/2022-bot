import {
    CacheType,
    CommandInteraction,
    GuildMember,
    Message,
    MessageActionRow,
    MessageButton,
    TextChannel,
} from "discord.js";
import {Config} from "../../config";
import {FindAndUpdate, teamCollection, WithTransaction} from "../../helpers/database";
import {
    ErrorMessage,
    ResponseEmbed,
    SafeDeferReply,
    SafeReply,
} from "../../helpers/responses";
import {InviteType, TeamType} from "../../types";
import {NotInGuildResponse, TeamFullResponse} from "./team-shared";
import {Timestamp} from "../../helpers/misc";
import {MessageButtonStyles} from "discord.js/typings/enums";
import {hyperlink, TimestampStyles} from "@discordjs/builders";
import {logger} from "../../logger";
import {GetVerifiedUser} from "../../helpers/userManagement";

export const InviteToTeam = async (
    intr: CommandInteraction<CacheType>,
    team: TeamType
): Promise<any> => {
    if (!intr.inGuild()) {
        return SafeReply(intr, NotInGuildResponse());
    }

    if (team.members.length >= Config.teams.max_team_size) {
        return SafeReply(intr, TeamFullResponse());
    }

    const invitee = intr.options.getUser("user", true);
    await SafeDeferReply(intr);

    if (!(await GetVerifiedUser(invitee.id))) {
        return SafeReply(
            intr,
            ErrorMessage({
                title: "User Not Verified",
                message: [
                    "You can only invite verified users to your team.",
                    "Ask them to verify first with `/verify`.",
                ].join(" "),
            })
        );
    } else if (intr.user.id === invitee.id && !Config.dev_mode) {
        return SafeReply(
            intr,
            ErrorMessage({
                emote: ":thinking:",
                title: "You're Already In Your Team",
                message: [
                    "You tried to invite yourself to your own team. Sadly,",
                    "cloning hasn't been invented yet.",
                ].join(" "),
            })
        );
    } else if (team.members.includes(invitee.id)) {
        return SafeReply(
            intr,
            ErrorMessage({
                emote: ":thinking:",
                title: "Member Already In Your Team",
                message: `${invitee} is already a member of your team.`,
            })
        );
    } else if (team.invites.findIndex((inv) => inv.invitee === invitee.id) !== -1) {
        return SafeReply(
            intr,
            ErrorMessage({
                emote: ":thinking:",
                title: "Member Already Invited",
                message: `You already invited ${invitee}. Invites don't expire, just be patient.`,
            })
        );
    }

    const invite: InviteType = {
        teamName: team.name,
        invitee: invitee.id,
        inviteID: `${Date.now()}`,
    };

    let message: Message<boolean>;
    const inviteError = await WithTransaction(async (session) => {
        const inviteAdd = await FindAndUpdate<TeamType>(
            teamCollection,
            team,
            {$push: {invites: invite}},
            {session}
        );
        if (!inviteAdd) {
            return "Failed to add invite";
        }

        // NOTE: custom IDs must be of form "invite;ACTION;INVITE_ID"
        const buttonRow = new MessageActionRow().setComponents(
            new MessageButton()
                .setStyle(MessageButtonStyles.SECONDARY)
                .setCustomId(`invite;decline;${invite.inviteID}`)
                .setLabel("Decline"),
            new MessageButton()
                .setStyle(MessageButtonStyles.PRIMARY)
                .setCustomId(`invite;accept;${invite.inviteID}`)
                .setLabel("Accept")
        );
        const inviteMsg = ResponseEmbed()
            .setTitle(":partying_face: You've Been Invited")
            .setDescription(
                [
                    `You've been invited to join Team ${team.name}`,
                    `for ${Config.bot_info.event_name} by`,
                    `${(intr.member! as GuildMember).displayName}.`,
                ].join(" ")
            );

        try {
            message = await invitee.send({
                embeds: [inviteMsg],
                components: [buttonRow],
            });
        } catch (err) {
            return `Failed to invite user: ${err}`;
        }

        return "";
    });

    if (inviteError) {
        return SafeReply(
            intr,
            ErrorMessage({
                title: "Unable to DM User",
                message: [
                    `It seems ${invitee} doesn't allow DMs from this server. Please ask them to`,
                    hyperlink(
                        "enable direct messages",
                        "https://support.discord.com/hc/articles/217916488-Blocking-Privacy-Settings"
                    ),
                    `and then re-invite them.`,
                ].join(" "),
            })
        );
    }

    const teamText = (await intr.guild!.channels.fetch(team.textChannel)) as TextChannel;
    const invitedMember = await intr.guild!.members.fetch(invitee.id)!;
    const invitedEmbed = ResponseEmbed()
        .setTitle(":white_check_mark: Invite Sent")
        .setDescription(`${invitedMember.displayName} has been invited.`);

    try {
        // prevent message duplication when inviting inside team channel
        if (teamText.id !== intr.channelId) {
            await teamText.send({embeds: [invitedEmbed]});
        }
    } catch (err) {
        logger.warn(`Failed to send channel creation message to ${teamText}: ${err}`);
    }
    return SafeReply(intr, {embeds: [invitedEmbed], ephemeral: true});
};
