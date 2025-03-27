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
import CardReplier from "./cardReplier";
import config from "./config.json" assert { type: "json" };
import { chat } from "./model.js";

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
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
async function callWithStream(requestContent:string, callback:Function) {
  const messages = [{ role: "user", content: requestContent }];

  // Mock implementation - replace with actual API call
  const mockResponses = [
    { status: 200, output: { choices: [{ message: { content: 'This is a ' } }] } },
    { status: 200, output: { choices: [{ message: { content: 'streamed ' } }] } },
    { status: 200, output: { choices: [{ message: { content: 'response.' } }] } },
  ];

  let fullContent = "";
  let length = 0;

  for (const response of mockResponses) {
    if (response.status === 200) {
      fullContent += response.output.choices[0].message.content;
      const fullContentLength = fullContent.length;

      // if (fullContentLength - length > 5) {
        await callback(response.output.choices[0].message.content,false,false,false);
        // await callback(fullContent);
        console.log(
          `调用流式更新接口更新内容：current_length: ${length}, next_length: ${fullContentLength}`
        );
        length = fullContentLength;
      // }
    } else {
      await callback(response.output.choices[0].message.content,true,true,true);
      throw new Error(`Request failed with status: ${response.status}`);
    }
  }

  await callback(fullContent,true,true,false);
  console.log(
    `Request Content: ${requestContent}\nFull response: ${fullContent}\nFull response length: ${fullContent.length}`
  );
  return fullContent;
}

// 机器人接收消息回调
client.registerCallbackListener(TOPIC_ROBOT, async (res:DWClientDownStream) => {
  // 注册机器人回调事件
  // debugger;
  const message = JSON.parse(res.data);
  const { text, senderStaffId, sessionWebhook, senderNick } = message as RobotMessage;
  console.log("收到消息==>", text?.content);
  // console.log(888,res.data);
  // 卡片模板 ID
  // const cardTemplateId = "2c278d79-fc0b-41b4-b14e-8b8089dc08e8.schema"; // 该模板只用于测试使用，如需投入线上使用，请导入卡片模板 json 到自己的应用下
  const cardTemplateId = "b83af3a1-638a-49ac-88d7-d5d7ba090972.schema"; // bot-app
  // 卡片公有数据，非字符串类型的卡片数据参考文档：https://open.dingtalk.com/document/orgapp/instructions-for-filling-in-api-card-data
  const contentKey = "content";
  const cardData: Record<string, any> = { [contentKey]: "" };

  const cardInstance = new CardReplier(client as any, message);
  // 创建并投放卡片: https://open.dingtalk.com/document/isvapp/create-and-deliver-cards
  const cardInstanceId = await cardInstance.createAndDeliverCard({
    cardTemplateId,
    cardData: convertJSONValuesToString(cardData),
  });

  console.log("reply card: ", cardInstanceId, cardData);
  async function streaming(
    contentValue:string,
    isFull = false,
    isFinalize = false,
    isError = false
  ) {
    return await cardInstance.streanUpdateCard({
      cardInstanceId,
      content: contentValue,
      // content: convertJSONValuesToString(cardData),
      guid: uuidv4(), //请求调用的唯一标志，系统内部用于幂等判断。
      key: contentKey, //要进行流式更新的变量。
      isFull: isFull,
      isFinalize: isFinalize,
      isError: isError,
    });
  }
  
  // 更新卡片: https://open.dingtalk.com/document/orgapp/interactive-card-update-interface

  const fullContentValue = await callWithStream(text?.content, streaming);
  // await streaming(fullContentValue,true,true,false);
  
  client.socketCallBackResponse(res.headers.messageId, EventAck.SUCCESS);
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
