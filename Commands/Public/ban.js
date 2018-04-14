const { create: CreateModLog } = require("../../Modules/ModLog");
const ArgParser = require("../../Modules/MessageUtils/Parser");

module.exports = async ({ client, Constants: { Colors, Text }, configJS }, { serverDocument }, msg, commandData) => {
	if (msg.suffix) {
		let [inputMember, ...reason] = ArgParser.parseQuoteArgs(msg.suffix, msg.suffix.includes("|") ? "|" : " ");
		const isJustUserID = /^\d+$/.test(inputMember);
		let isGuildMember = false, hasReason = true, member = null;
		if (isJustUserID) {
			if (msg.guild.members.has(inputMember)) {
				member = msg.guild.member(inputMember);
				isGuildMember = true;
			} else {
				member = await client.users.fetch(inputMember, true);
			}
		} else {
			member = await client.memberSearch(inputMember, msg.guild).catch(() => null);
			if (!member) {
				member = await client.memberSearch(`${inputMember} ${reason.join(" ")}`.trim(), msg.guild).catch(() => null);
				hasReason = false;
				if (!member) {
					member = null;
					isGuildMember = false;
				} else {
					isGuildMember = true;
				}
			} else {
				isGuildMember = true;
			}
		}
		reason = (hasReason && reason.length && reason.join(" ")) || "Unspecified reason...";
		const { canClientBan, memberAboveAffected } = await client.canDoActionOnMember(msg.guild, msg.member, (isGuildMember && member) || null, "ban");
		if (!canClientBan) {
			return msg.send({
				embed: {
					color: Colors.RED,
					title: `I'm sorry, but I can't do that... 😔`,
					description: `I'm missing permissions to ban that user!\nEither they are above me or I don't have the **Ban Members** permission.`,
				},
			});
		}
		if (!memberAboveAffected) {
			return msg.send({
				embed: {
					color: Colors.RED,
					title: `I'm sorry, but I cannot let you do that! 😶`,
					description: `You cannot ban someone who's above you! That's dumb!`,
				},
			});
		}
		const banned = () => msg.send({
			embed: {
				image: {
					url: serverDocument.config.ban_gif,
				},
				color: Colors.SUCCESS,
				description: `Bye-Bye **@${isGuildMember ? client.getName(msg.guild, serverDocument, member) : `${member.tag}`}** 🔨`,
			},
		});
		const dmBanned = async id => {
			if (isGuildMember) {
				try {
					await client.users.get(id).send({
						embed: {
							color: Colors.RED,
							description: `Oh snap, you just got banned from \`${msg.guild}\`!`,
							fields: [
								{
									name: `Reason`,
									value: `${reason}`,
									inline: true,
								},
								{
									name: `Staff Member`,
									value: `@${msg.author.tag}`,
									inline: true,
								},
							],
							thumbnail: {
								url: msg.guild.iconURL(),
							},
						},
					});
				} catch (_) {
					// Too bad
				}
			}
		};
		if (member) {
			msg.send({
				embed: {
					color: Colors.INPUT,
					title: `Waiting on @__${client.getName(msg.guild, serverDocument, msg.member)}__'s input..`,
					description: `${isJustUserID ? `Are you sure you want to ban **@${isGuildMember ? `${client.getName(msg.guild, serverDocument, member)} (${member})` : member.tag}**?` : `Are you sure you want to ban **@${client.getName(msg.guild, serverDocument, member)} (${member})**?`}\n\nThey will be banned for\`\`\`css\n${reason}\`\`\``,
					footer: {
						text: `They won't be able to join again until they get unbanned!`,
					},
				},
			});
			const collector = msg.channel.createMessageCollector(
				m => m.author.id === msg.author.id,
				{ time: 120000 }
			);
			collector.on("collect", async message => {
				if (message.editedAt) {
					collector.stop();
					return null;
				}
				if (message.content) {
					collector.stop();
					try {
						await message.delete();
					} catch (_) {
						// Meh
					}
					if (configJS.yesStrings.includes(message.content.toLowerCase().trim())) {
						if (isGuildMember) {
							member.ban({ days: 1, reason: `${reason} | Command issued by @${msg.author.tag}` });
						} else {
							msg.guild.members.ban(member.id, { days: 1, reason: `${reason} | Command issued by @${msg.author.tag}` });
						}
						dmBanned(member.id);
						await CreateModLog(msg.guild, "Ban", member, msg.author, reason);
						return banned();
					} else {
						return msg.send({
							embed: {
								description: `Ban canceled! 😓`,
								color: Colors.INFO,
							},
						});
					}
				}
			});
		} else {
			msg.send({
				embed: {
					color: Colors.SOFT_ERR,
					description: `I couldn't find a matching member on this server...`,
					footer: {
						text: `If you have a user ID you can run "${msg.guild.commandPrefix}${commandData.name} ID" to ban them!`,
					},
				},
			});
		}
	} else {
		msg.send({
			embed: {
				color: Colors.INVALID,
				title: `Do you want me to ban you? 😮`,
				description: Text.INVALID_USAGE(commandData, msg.guild.commandPrefix),
			},
		});
		const collector = msg.channel.createMessageCollector(
			m => m.author.id === msg.author.id,
			{ time: 60000 }
		);
		collector.on("collect", async message => {
			if (message.editedAt) {
				collector.stop();
				return null;
			}
			if (message.content) {
				collector.stop();
				try {
					await message.delete();
				} catch (_) {
					// Meh
				}
				if (configJS.yesStrings.includes(message.content.toLowerCase().trim())) {
					msg.send({
						embed: {
							color: Colors.SOFT_ERR,
							description: `Ok! Bye-Bye!`,
							footer: {
								text: `Just kidding! I'd never ban you. ❤️`,
							},
						},
					});
				}
			}
		});
	}
};
