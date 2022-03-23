import {hyperlink} from "@discordjs/builders";
import {APIMessage} from "discord-api-types";
import {ButtonInteraction, CacheType, Guild, Message, TextChannel} from "discord.js";
import {TEAM_MEMBER_PERMS} from "../../commands/team/team-shared";
import {Config} from "../../config";
import {FindAndUpdate, FindOne, teamCollection} from "../../helpers/database";
import {Timestamp} from "../../helpers/misc";
import {ErrorMessage, SafeReply, SuccessMessage} from "../../helpers/responses";
import {GetUserTeam, GetVerifiedUser} from "../../helpers/userManagement";
import {logger} from "../../logger";
import {ButtonAction, InviteType, TeamType} from "../../types";

const inviteAction: ButtonAction = {
    execute: async (intr: ButtonInteraction<CacheType>) => {
        if (!GetVerifiedUser(intr.user)) {
            return SafeReply(
                intr,
                ErrorMessage({
                    title: "Not Verified",
                    message: [
                        "Only verified users can join teams. You need to join",
                        `the ${Config.bot_info.event_name} Discord server and`,
                        "use `/verify your-email`.",
                    ].join(" "),
                })
            );
        }

        const [_, action, inviteId] = intr.customId.split(";");
        const team = await FindOne<TeamType>(teamCollection, {
            // a team containing an invite entry for inviteId and invitee
            invites: {$elemMatch: {invitee: intr.user.id, inviteID: inviteId}},
        });

        if (!team) {
            return intr.update(
                ErrorMessage({
                    title: "Team Deleted",
                    message: "It appears the team this invite is for was deleted.",
                })
            );
        }

        const invite = team.invites.find(
            (inv) => inv.inviteID === inviteId && inv.invitee === intr.user.id
        )!;

        let result;
        if (action === "accept") {
            result = await HandleOfferAccept(team, invite, intr);
        } else if (action === "decline") {
            result = await HandleOfferDecline(team, invite, intr);
        } else {
            result = {error: "Invalid action"};
        }

        const {error, response} = result;
        if (error) {
            return SafeReply(
                intr,
                ErrorMessage({
                    title: "Operation Failed",
                    message: error,
                    ephemeral: true, // allows to user to de-clutter their DMs
                })
            );
        } else {
            return intr.update(
                SuccessMessage({title: `Invite ${action}ed`, message: response})
            );
        }
    },
};

const HandleOfferAccept = async (
    team: TeamType,
    invite: InviteType,
    intr: ButtonInteraction<CacheType>
): Promise<{error?: string; response?: string}> => {
    const now = Date.now();
    const [existingTeam, userInfo] = await Promise.all([
        GetUserTeam(intr.user),
        GetVerifiedUser(intr.user),
    ]);

    if (existingTeam) {
        return {
            error: `You're already a member of ${existingTeam.name}. Leave with \`/team leave\` first.`,
        };
    } else if (!userInfo) {
        const joinLink = hyperlink(
            `${Config.bot_info.event_name} Discord server`,
            "https://discord.com/invite/xUV9yBqjH4"
        );
        return {
            error: `You're not verified yet. You need to join the ${joinLink} and run \`/verify your-email\` first.`,
        };
    }

    // 1. try to fetch text and voice channels
    const guild = await intr.client.guilds.fetch(
        Config.dev_mode ? Config.development.guild : Config.production.guild
    );

    const [text, voice] = await Promise.all([
        guild.channels.fetch(team.textChannel),
        guild.channels.fetch(team.voiceChannel),
    ]);

    // 2. update permissions (thanks for the shortcut, Denis!)
    await text!.permissionOverwrites.edit(invite.invitee, TEAM_MEMBER_PERMS);
    await voice!.permissionOverwrites.edit(invite.invitee, TEAM_MEMBER_PERMS);

    // 3. assuming 1 and 2 are a success, pop the invite and push the user into the members array
    await FindAndUpdate<TeamType>(
        teamCollection,
        {stdName: team.stdName},
        {$pull: {invites: invite}, $push: {members: invite.invitee}}
    );

    // 4. send join message to text channel
    try {
        (text as TextChannel).send(
            SuccessMessage({
                title: "Members++",
                message: `<@${invite.invitee}> has joined the team!`,
            })
        );
    } catch (err) {
        logger.warn(`Failed to send join message to ${text}: ${err}`);
    }

    return {response: `You joined ${team.name} ${Timestamp(now)}.`};
};

const HandleOfferDecline = async (
    team: TeamType,
    invite: InviteType,
    intr: ButtonInteraction<CacheType>
): Promise<{error?: string; response?: string}> => {
    const now = Date.now();
    // 1. pop the invite
    await FindAndUpdate<TeamType>(
        teamCollection,
        {stdName: team.stdName},
        {$pull: {invites: invite}}
    );

    // 2. Try to send decline message to text channel
    const guild = await intr.client.guilds.fetch(
        Config.dev_mode ? Config.development.guild : Config.production.guild
    );
    const text = (await guild.channels.fetch(team.textChannel)) as TextChannel;

    // 4. send join message to text channel
    try {
        text.send(
            ErrorMessage({
                emote: ":slight_frown:",
                title: "Invite Decline",
                message: `<@${invite.invitee}> declined your invite.`,
            })
        );
    } catch (err) {
        logger.warn(`Failed to send decline message to ${text}: ${err}`);
    }

    return {response: `You declined to join ${team.name} ${Timestamp(now)}.`};
};

export {inviteAction as action};
