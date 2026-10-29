import React, { useEffect, useRef } from "react";
import type { ConversationMessage } from "./types";

export interface MessageListProps {
  subject: string;
  messages: ConversationMessage[];
}

export const MessageList: React.FC<MessageListProps> = ({
  subject,
  messages,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Sort by sentAt oldest first (or preserve order)
  const sortedMessages = [...messages].sort((a, b) => {
    if (!a.sentAt || !b.sentAt) return 0;
    return new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime();
  });

  // Auto-scroll to latest message when thread or messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [messages, subject]);

  return (
    <div className="px-5 sm:px-7 pt-5 flex flex-col gap-3.5 flex-1 overflow-y-auto w-full">
      {/* Subject as h2 */}
      <h2 className="text-[20px] font-extrabold text-[#14213d] leading-snug">
        {subject}
      </h2>

      {/* Messages area */}
      <div className="flex flex-col gap-4 py-2 w-full flex-1">
        {sortedMessages.length === 0 ? (
          <div className="py-10 text-center text-[#6b7280] italic text-[14px]">
            Wala pang mensahe.
          </div>
        ) : (
          sortedMessages.map((msg) => {
            const isFarmer = msg.from === "farmer";

            if (isFarmer) {
              return (
                <div
                  key={msg.id}
                  className="flex flex-col items-start max-w-[85%] sm:max-w-[80%]"
                >
                  <span className="text-[12px] font-bold text-[#4b5563] mb-1 pl-1">
                    Magsasaka
                  </span>
                  <div className="bg-[#eef3e8] text-[#14213d] rounded-[18px_18px_18px_4px] p-[12px_16px] text-[15px] leading-relaxed shadow-2xs">
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    {msg.tag && (
                      <span className="inline-block mt-2 px-2.5 py-[3px] rounded-full text-[12px] font-extrabold bg-[#fde8e8] text-[#9b1c1c]">
                        {msg.tag}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            // Officer message
            return (
              <div
                key={msg.id}
                className="flex flex-col items-end max-w-[85%] sm:max-w-[80%] ml-auto"
              >
                <span className="text-[12px] font-bold text-[#4b5563] mb-1 pr-1">
                  Ikaw
                </span>
                <div className="bg-[#0f2a5c] text-white rounded-[18px_18px_4px_18px] p-[12px_16px] text-[15px] leading-relaxed shadow-2xs">
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};
