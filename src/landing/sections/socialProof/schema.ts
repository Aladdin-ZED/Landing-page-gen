/**
 * socialProof data: one shared content model for the three variants (switching variant keeps the
 * merchant's chats, stories and counter). Every piece is merchant proof — `sample` stays on until
 * the admin replaces the sample content with real chats, stories and numbers.
 */
import { z } from "zod";
import { AssetRef } from "@/lib/page/schema";
import type { SectionProps } from "../../types";

const Message = z.object({
  from: z.enum(["customer", "store"]).default("customer"),
  text: z.string().max(300).default(""),
  /** as shown in the app, e.g. "10:42" */
  time: z.string().max(12).default(""),
  /** photo the customer sent */
  photo: AssetRef.optional(),
});

const Chat = z.object({
  name: z.string().min(1).max(40),
  city: z.string().max(40).default(""),
  /** date chip at the top of the thread ("Aujourd'hui") */
  day: z.string().max(24).default(""),
  messages: z.array(Message).min(1).max(8),
});

const Story = z.object({
  name: z.string().min(1).max(40),
  city: z.string().max(40).default(""),
  /** story age as the app prints it ("2 h") */
  when: z.string().max(16).default(""),
  caption: z.string().max(90).default(""),
  /** the customer's photo; empty → a type-only story on a light field */
  image: AssetRef.optional(),
});

export const schema = z.object({
  kicker: z.string().max(60).default(""),
  title: z.string().max(140).default(""),
  lead: z.string().max(260).default(""),
  chats: z.array(Chat).min(1).max(3),
  /** glass callout pinned to the first photo message (WhatsApp variant) */
  note: z.string().max(80).default(""),
  stories: z.array(Story).min(1).max(6),
  /** real number of delivered orders (counter variant); 0 hides it */
  count: z.number().int().min(0).max(10_000_000).default(0),
  countLabel: z.string().max(80).default(""),
  since: z.string().max(60).default(""),
  /** delivery cities, comma or line separated */
  cities: z.string().max(600).default(""),
  cta: z.string().max(60).default(""),
  sample: z.boolean().default(false),
});

export type Data = z.infer<typeof schema>;
export type ChatData = Data["chats"][number];
export type MessageData = ChatData["messages"][number];
export type StoryData = Data["stories"][number];
export type Props = SectionProps<Data>;
