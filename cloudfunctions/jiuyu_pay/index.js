//云开发实现支付 - 微信支付APIv3
const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const WxPay = require('wechatpay-node-v3');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const db = cloud.database();

// 生成小程序支付参数的辅助函数
const generateMiniProgramPayParams = (prepayId, config) => {
  const timestamp = generateTimestamp().toString();
  const nonceStr = generateNonceStr();
  const packageName = `prepay_id=${prepayId}`;

  // 构建签名字符串
  const signStr = `${config.appid}\n${timestamp}\n${nonceStr}\n${packageName}\n`;
  
  // 使用商户私钥进行RSA签名
  try {
    const privateKey = fs.readFileSync('./apiclient_key.pem', 'utf8');
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signStr);
    const paySign = sign.sign(privateKey, 'base64');
    
    return {
      timeStamp: timestamp,
      nonceStr: nonceStr,
      package: packageName,
      signType: 'RSA',
      paySign: paySign,
    };
  } catch (error) {
    console.error('生成支付签名失败:', error);
    throw new Error('生成支付签名失败: ' + error.message);
  }
};

// APIv3辅助函数（全局作用域）
const generateNonceStr = () => {
  return Math.random().toString(36).substr(2, 15);
};

const generateTimestamp = () => {
  return Math.floor(Date.now() / 1000);
};

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.FROM_OPENID || wxContext.OPENID;
  const { action, description, amount, planId, planName } = event;

  // 如果有 action 参数，路由到相应的处理函数
  if (action) {
    switch (action) {
      case 'createOrder':
        return await exports.createOrder(event, context);
      case 'checkMemberStatus':
        return await exports.checkMemberStatus(event, context);
      case 'activateMember':
        return await exports.activateMember(event, context);
      case 'updateMemberOrder':
        return await exports.updateMemberOrder(event, context);
      default:
        return { errcode: -1, errmsg: '未知的操作类型' };
    }
  }

  // 如果没有action，则返回错误
  return { errcode: -1, errmsg: '缺少操作类型' };
};

// 新增一个云函数用于创建订单
exports.createOrder = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.FROM_OPENID || wxContext.OPENID;
  const { description, amount, planType } = event;

  // 微信支付APIv3配置
  const config = {
    appid: 'wxe178865217b0c046', // 小程序AppID
    mchid: '1723178098', // 微信支付商户号
    apiV3Key: 'APIV3easyKEY2025remember12345678', // APIv3密钥
    notify_url: 'https://mp.weixin.qq.com', // 支付回调网址
    serial_no: '46FBEF13AC6003510F170C85F75CEEA5D9FB0EE3',
    publicKey: 'PUB_KEY_ID_0117231780982025080700212087000601'
  };
  
  // 读取商户证书和私钥文件
  const apiclientCert = fs.readFileSync('./apiclient_cert.pem');
  const apiclientKey = fs.readFileSync('./apiclient_key.pem');
  
  // 初始化微信支付SDK
  let weChatPay;
  try {
    weChatPay = new WxPay({
      appid: config.appid,
      mchid: config.mchid,
      publicKey: apiclientCert,
      privateKey: apiclientKey
    });
    console.log('微信支付SDK初始化成功');
  } catch (error) {
    console.error('SDK初始化失败:', error.message);
    throw new Error('微信支付SDK初始化失败，请检查证书配置');
  }
  
  console.log('支付配置:', config);
  console.log('支付参数:', { description, amount, planType });

  try {
    // 商户自行生成商户订单号
    const outTradeNo = `MEMBER_${Date.now()}_${Math.round(Math.random() * 10000)}`;

    // 存储订单信息到数据库
    const orderData = {
      userId: wxContext.FROM_OPENID || wxContext.OPENID,
      outTradeNo: outTradeNo,
      planType: planType || '',
      amount: amount / 100, // 转换为元
      status: 'pending', // pending, success, failed
      createTime: db.serverDate(),
      updateTime: db.serverDate()
    };

    await db.collection('jiuyu_member_orders').add({
      data: orderData
    });

    // APIv3 JSAPI支付统一下单
    const orderParams = {
      appid: config.appid,
      mchid: config.mchid,
      description: description || '小舟摇书池会员服务',
      out_trade_no: outTradeNo,
      notify_url: config.notify_url,
      amount: {
        total: amount, // 金额，单位分
        currency: 'CNY'
      },
      payer: {
        openid: wxContext.FROM_OPENID || wxContext.OPENID
      }
    };
    
    console.log('APIv3统一下单参数:', orderParams);
    console.log('用户openid:', wxContext.OPENID);
    
    // 使用SDK调用微信支付统一下单接口
    try {
      const result = await weChatPay.transactions_jsapi(orderParams);
      
      console.log('APIv3统一下单返回结果:', result);
      
      // 检查返回结果，wechatpay-node-v3可能直接返回支付参数
      let prepayId;
      if (result.prepay_id) {
        prepayId = result.prepay_id;
      } else if (result.package && result.package.includes('prepay_id=')) {
        // 如果SDK直接返回了支付参数，直接使用
        console.log('SDK直接返回支付参数，无需重新生成');
        return {
          data: result,
          out_trade_no: outTradeNo
        };
      } else {
        throw new Error('获取prepay_id失败: ' + JSON.stringify(result));
      }
      
      // 生成小程序支付参数
      const payParams = generateMiniProgramPayParams(prepayId, config);
      
      return {
        data: payParams,
        out_trade_no: outTradeNo
      };
    } catch (sdkError) {
      console.error('微信支付SDK调用失败:', sdkError);
      throw new Error('支付接口调用失败: ' + sdkError.message);
    }
  } catch (error) {
    console.error('创建支付订单失败:', error);
    return {
      errcode: -1,
      errmsg: error.message || '创建订单失败'
    };
  }
};

// 微信支付回调通知
exports.payNotify = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { APPID, MCHID, PARTNERKEY } = process.env;

  const config = {
    appid: APPID, // 小程序appid
    mchid: MCHID, // 商户号
    partnerKey: PARTNERKEY, // 微信支付安全密钥
  };

  const api = new Tenpay(config);

  try {
    // 验证签名并解析回调数据
    console.log('收到支付回调通知，event.body:', event.body);
    const result = await api.middleware(event.body);
    console.log('支付回调解析结果:', result);

    if (result.return_code === 'SUCCESS' && result.result_code === 'SUCCESS') {
      console.log('支付回调成功，开始处理订单和激活会员');
      const { out_trade_no, transaction_id } = result;

      // TODO: 在这里完善会员激活逻辑
      // 1. 更新订单状态为成功
      const updateOrderRes = await db.collection('jiuyu_member_orders').where({
        outTradeNo: out_trade_no
      }).update({
        data: {
          status: 'success',
          transactionId: transaction_id,
          updateTime: db.serverDate()
        },
      });
      console.log('订单状态更新结果:', updateOrderRes);

      // 2. 激活会员
      const activateResult = await exports.activateMember({ outTradeNo: out_trade_no, transactionId: transaction_id });
      if (!activateResult.success) {
        console.error('会员激活失败:', activateResult.errmsg);
      } else {
        console.log('会员激活成功, 过期时间:', new Date(activateResult.memberExpireTime));
      }

      console.log('返回微信支付成功通知');
      return api.success(); // 返回成功给微信支付
    } else {
      console.error('支付回调失败:', result);
      console.log('返回微信支付失败通知');
      return api.fail('支付失败');
    }
  } catch (error) {
    console.error('处理支付回调异常:', error);
    return api.fail('处理异常');
  }
};

// 新增一个云函数用于激活会员
exports.activateMember = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.FROM_OPENID || wxContext.OPENID;
  const { outTradeNo, transactionId, planId, planName } = event;
  const _ = db.command;

  try {
    // 1. 更新订单状态为成功
    await db.collection('jiuyu_member_orders').where({
      userId: openId,
      outTradeNo: outTradeNo
    }).update({
      data: {
        status: 'success',
        transactionId: transactionId,
        updateTime: db.serverDate()
      },
    });

    // 2. 更新用户会员信息
    console.log('查询用户信息, openid:', wxContext.FROM_OPENID || wxContext.OPENID);
    const userRes = await db.collection('jiuyu_users').where({
      openid: openId
    }).get();
    console.log('用户查询结果:', userRes.data.length, '条记录');

    let startDate = Date.now();
    let endDate = Date.now();

    if (userRes.data.length > 0 && userRes.data[0].membershipInfo && userRes.data[0].membershipInfo.isMember && userRes.data[0].membershipInfo.endDate) {
      // 如果已经是会员，从当前会员过期时间开始计算
      startDate = userRes.data[0].membershipInfo.endDate;
      endDate = userRes.data[0].membershipInfo.endDate;
    }

    // 创建一个Date对象用于计算，保持endDate变量为时间戳
    const calculatedEndDate = new Date(endDate);

    // 根据planType确定会员时长
    let durationDays = 30; // 默认开通1个月会员
    if (event.planType === 'monthly') {
      durationDays = 30;
    } else if (event.planType === 'quarterly') {
      durationDays = 90;
    } else if (event.planType === 'halfYear') {
      durationDays = 180;
    } else if (event.planType === 'yearly') {
      durationDays = 365;
    }

    calculatedEndDate.setDate(calculatedEndDate.getDate() + durationDays);
    endDate = calculatedEndDate.getTime();

    console.log('准备更新用户会员信息, membershipInfo:', { isMember: true, startDate: new Date(startDate), endDate: new Date(endDate) });
    const updateResult = await db.collection('jiuyu_users').where({
      openid: openId
    }).update({
      data: {
        membershipInfo: {
          isMember: true,
          startDate: startDate,
          endDate: endDate,
        },
        updateTime: db.serverDate()
      },
    });
    console.log('用户会员信息更新结果:', updateResult);

    // 注意：云函数无法直接操作前端的本地存储。
    // 在前端（miniprogram/pages/membership/membership.js）支付成功回调中，
    // 需要手动清除 hasShownExpiredModal 标志，以确保会员过期弹窗在续费后能再次正常显示。
    return { success: true, membershipInfo: { isMember: true, startDate: startDate, endDate: endDate } };
  } catch (error) {
    console.error('激活会员失败:', error);
    return { success: false, errmsg: error.message || '激活会员失败' };
  }
};

// 新增一个云函数用于检查会员状态
exports.checkMemberStatus = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const _ = db.command;

  try {
    const memberInfoRes = await db.collection('jiuyu_users').where({
      openid: wxContext.FROM_OPENID || wxContext.OPENID,
    }).field({
      membershipInfo: true
    }).get();

    if (memberInfoRes.data.length > 0) {
      const user = memberInfoRes.data[0];
      const now = new Date();
      let isMember = false;
      let membershipInfo = user.membershipInfo || { isMember: false, startDate: null, endDate: null };

      if (membershipInfo.isMember && membershipInfo.endDate && membershipInfo.endDate > now.getTime()) {
        isMember = true;
      } else if (membershipInfo.isMember && membershipInfo.endDate && membershipInfo.endDate <= now.getTime()) {
        // 如果会员过期，将数据库中的 isMember 字段更新为 false
        await db.collection('jiuyu_users').where({
          openid: wxContext.FROM_OPENID || wxContext.OPENID,
        }).update({
          data: {
            membershipInfo: {
              isMember: false,
              startDate: null,
              endDate: null,
            }
          }
        });
        isMember = false; // 更新内存中的 isMember 状态
        console.log(`checkMemberStatus: User ${wxContext.FROM_OPENID || wxContext.OPENID} membership expired, updated isMember to false in DB.`);
      }

      console.log(`checkMemberStatus: user.membershipInfo.isMember=${membershipInfo.isMember}, user.membershipInfo.endDate=${membershipInfo.endDate}, now=${now.getTime()}, calculated isMember=${isMember}`);
      return { success: true, isMember: isMember, membershipInfo: membershipInfo };
    } else {
      console.log('checkMemberStatus: No member info found, returning isMember=false');
      return { success: true, isMember: false, membershipInfo: { isMember: false, startDate: null, endDate: null } };
    }
  } catch (error) {
    console.error('检查会员状态失败:', error);
    return { success: false, errmsg: error.message || '检查会员状态失败' };
  }
};

// 新增一个云函数用于更新会员订单状态
exports.updateMemberOrder = async (event, context) => {
  const { outTradeNo, status, transactionId } = event;
  const wxContext = cloud.getWXContext();
  const openId = wxContext.FROM_OPENID || wxContext.OPENID;

  try {
    const _ = db.command;
    const res = await db.collection('jiuyu_member_orders').where({
      outTradeNo: outTradeNo
    }).update({
      data: {
        status: status,
        transactionId: transactionId || '',
        updateTime: db.serverDate()
      },
    });
    return { success: true, data: res };
  } catch (error) {
    console.error('更新会员订单失败:', error);
    return { success: false, errmsg: error.message || '更新订单失败' };
  }
};

// APIv3辅助函数