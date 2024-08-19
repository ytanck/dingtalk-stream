import axios from "axios";
const GPTKEY = "app-P4efSPFpYHO6Ho8oWV0JbNIN";

// 文本对话消息chat-messages
export const chat = async (content: string, user: string) => {
  try {
    const response = await axios({
      method: "POST",
      // url: "http://172.31.21.89/v1/chat-messages",
      url: "http://113.57.100.72/v1/chat-messages",
      data: {
        inputs: {},
        query: content,
        response_mode: "blocking",
        conversation_id: "",
        user: user,
      },
      headers: {
        Authorization: `Bearer ${GPTKEY}`,
        "Content-Type": "application/json",
      },
    });
    return response.data.answer;
  } catch (error) {
    return error;
  }
};
