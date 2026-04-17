import { Link } from "react-router-dom";
import type { ChatModel } from "../types/app";

type Props = {
  projectId: string;
  chats: ChatModel[];
  onCreateChat: () => Promise<void>;
};

export function ChatList({ projectId, chats, onCreateChat }: Props) {
  return (
    <section className="panel">
      <div className="row-between">
        <h3>Chats</h3>
        <button onClick={() => void onCreateChat()}>New Chat</button>
      </div>
      <div className="stack">
        {chats.map((chat) => (
          <Link key={chat.id} className="list-item" to={`/projects/${projectId}/chat/${chat.id}`}>
            <span>{chat.title}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
