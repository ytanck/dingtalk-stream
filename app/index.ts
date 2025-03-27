import {
  DWClient,
  DWClientDownStream,
  EventAck,
  RobotMessage,
  TOPIC_ROBOT,
  TOPIC_CARD,
  TOPIC_AI_GRAPH_API,
} from "../src/index.js";
import axios from "axios";
import config from "./config.json" assert { type: "json" };
import { chat } from "./model.js";

// 中断程序前先关闭 websocket 连接
const handleExit = () => {
  client.disconnect();
  process.exit(0);
};
process.on("SIGINT", handleExit);
process.on("SIGTERM", handleExit);

const convertJSONValuesToString = (obj: Record<string, any>) => {
  const newObj: Record<string, string> = {};
  for (const key in obj) {
    const value = obj[key];
    if (obj.hasOwnProperty(key) && value != null) {
      if (typeof value === "string") {
        newObj[key] = value;
      } else {
        newObj[key] = JSON.stringify(value);
      }
    }
  }
  return newObj;
};

console.log("开始启动");
const client = new DWClient({
  clientId: config.clientId,
  clientSecret: config.clientSecret,
  debug: true,// 调试模式，开启后可以看到更多详细日志
});

// 机器人接收消息回调
client.registerCallbackListener(TOPIC_ROBOT, async (res:DWClientDownStream) => {
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
// 卡片回传请求回调
client.registerCallbackListener(TOPIC_CARD, async (event:DWClientDownStream) => {
  /**
   * 卡片事件回调文档：https://open.dingtalk.com/document/orgapp/event-callback-card
   */
  const message = JSON.parse(event.data);
  console.log("card callback message: ", message);

  const userPrivateData: Record<string, any> = {};

  const cardPrivateData = JSON.parse(message.content).cardPrivateData;
  const params = cardPrivateData.params;
  const local_input = params.local_input;

  if (local_input != null) {
    userPrivateData.private_input = local_input;
    userPrivateData.submitted = true;
  }

  const cardUpdateOptions = {
    updateCardDataByKey: true,
    updatePrivateDataByKey: true,
  };
  const response = {
    cardUpdateOptions,
    userPrivateData: {
      cardParamMap: convertJSONValuesToString(userPrivateData),
    },
  };

  console.log("card callback response: ", response);
  client.socketCallBackResponse(event.headers.messageId, response);
})
client.registerCallbackListener(TOPIC_AI_GRAPH_API,async (res: DWClientDownStream) => {
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
