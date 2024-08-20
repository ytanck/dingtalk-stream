import {
  DWClient,
  DWClientDownStream,
  EventAck,
  RobotMessage,
  TOPIC_ROBOT,
  TOPIC_AI_GRAPH_API,
} from "../src/index.js";
import axios from "axios";
import config from "./config.json" assert { type: "json" };
import { chat } from "./model.js";

console.log("开始启动");
const client = new DWClient({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  debug: true,
});
client.registerCallbackListener(TOPIC_ROBOT, async (res) => {
  // 注册机器人回调事件
  // debugger;
  const { text, senderStaffId, sessionWebhook, senderNick } = JSON.parse(
    res.data
  ) as RobotMessage;
  console.log("收到消息==>", text?.content);
  // console.log(888,res.data);
  const answer = await chat(text?.content, senderNick);

  // 发送消息:自定义机器人发送群消息 https://open.dingtalk.com/document/orgapp/custom-robots-send-group-messages
  const body = {
    at: {
      atUserIds: [senderStaffId],
      isAtAll: false,
    },
    text: {
      content: answer || "钉钉,让进步发生",
    },
    msgtype: "text",
  };

  const accessToken = await client.getAccessToken();
  const result = await axios({
    url: sessionWebhook,
    method: "POST",
    responseType: "json",
    data: body,
    headers: {
      "x-acs-dingtalk-access-token": accessToken,
    },
  });
  //console.log(result.data); //{ errcode: 0, errmsg: 'ok' }

  // 机器人topic，通过socketCallBackResponse方法返回消息响应
  if (result?.data) {
    client.socketCallBackResponse(res.headers.messageId, result.data);
  }
});
client
  .registerCallbackListener(
    TOPIC_AI_GRAPH_API,
    async (res: DWClientDownStream) => {
      // 注册AI插件回调事件
      console.log("收到ai消息");
      const { messageId } = res.headers;

      // 添加业务逻辑
      console.log(res);
      console.log(JSON.parse(res.data));

      // 通过Stream返回数据
      client.sendGraphAPIResponse(messageId, {
        response: {
          statusLine: {
            code: 200,
            reasonPhrase: "OK",
          },
          headers: {},
          body: JSON.stringify({
            text: "你好",
          }),
        },
      });
    }
  )
  .registerAllEventListener((message: DWClientDownStream) => {
    return { status: EventAck.SUCCESS };
  })
  .connect();
