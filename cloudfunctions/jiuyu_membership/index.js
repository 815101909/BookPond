const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const users = db.collection('jiuyu_users');

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const { OPENID, FROM_OPENID } = wxContext;
  const userOpenid = FROM_OPENID || OPENID;
  const { action, payload } = event;

  switch (action) {
    case 'getMembershipPlans':
      return getMembershipPlans();
    case 'addMembershipPlan':
      return addMembershipPlan(payload);
    case 'updateMembershipPlan':
      return updateMembershipPlan(payload);
    case 'deleteMembershipPlan':
      return deleteMembershipPlan(payload);
    case 'grantMembershipDays':
      return grantMembershipDays(userOpenid, payload);
    case 'getUserMembershipInfo':
      return getUserMembershipInfo(userOpenid);
    default:
      return { code: -1, message: '未知action' };
  }
};

async function getMembershipPlans() {
  try {
    const res = await db.collection('jiuyu_membership').get();
    return { code: 0, data: res.data };
  } catch (e) {
    return { code: -1, message: '获取会员计划失败', error: e };
  }
}

async function addMembershipPlan(plan) {
  try {
    const res = await db.collection('jiuyu_membership').add({
      data: plan
    });
    return { code: 0, data: res._id };
  } catch (e) {
    return { code: -1, message: '添加会员计划失败', error: e };
  }
}

async function updateMembershipPlan({ _id, ...updates }) {
  try {
    const res = await db.collection('jiuyu_membership').doc(_id).update({
      data: updates
    });
    return { code: 0, data: res.stats.updated };
  } catch (e) {
    return { code: -1, message: '更新会员计划失败', error: e };
  }
}

async function deleteMembershipPlan(_id) {
  try {
    const res = await db.collection('jiuyu_membership').doc(_id).remove();
    return { code: 0, data: res.stats.removed };
  } catch (e) {
    return { code: -1, message: '删除会员计划失败', error: e };
  }
}

// 发放会员天数
async function grantMembershipDays(openid, { days, reason }) {
  try {
    console.log('发放会员天数:', { openid, days, reason });
    
    if (!openid) {
      return { code: -1, message: '用户openid不能为空' };
    }
    
    if (!days || days <= 0) {
      return { code: -1, message: '会员天数必须大于0' };
    }
    
    // 获取用户信息
    const userResult = await users.where({ openid }).get();
    
    if (userResult.data.length === 0) {
      return { code: -1, message: '用户不存在' };
    }
    
    const user = userResult.data[0];
    const now = new Date();
    
    // 计算新的会员到期时间
    let membershipEndDate;
    if (user.membershipEndDate) {
      const currentEndDate = new Date(user.membershipEndDate);
      // 如果当前会员还未过期，在原有基础上增加天数
      if (currentEndDate > now) {
        membershipEndDate = new Date(currentEndDate.getTime() + days * 24 * 60 * 60 * 1000);
      } else {
        // 如果已过期，从当前时间开始计算
        membershipEndDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      }
    } else {
      // 如果从未有过会员，从当前时间开始计算
      membershipEndDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    }
    
    // 更新用户会员信息
    const updateResult = await users.doc(user._id).update({
      data: {
        membershipEndDate: membershipEndDate.toISOString(),
        isMember: true,
        updated_at: now.toISOString()
      }
    });
    
    console.log('会员天数发放成功:', {
      openid,
      days,
      newEndDate: membershipEndDate.toISOString(),
      reason
    });
    
    return {
      code: 0,
      message: '会员天数发放成功',
      data: {
        membershipEndDate: membershipEndDate.toISOString(),
        grantedDays: days
      }
    };
  } catch (error) {
    console.error('发放会员天数失败:', error);
    return {
      code: -1,
      message: '发放会员天数失败',
      error: error.message
    };
  }
}

// 获取用户会员信息
async function getUserMembershipInfo(openid) {
  try {
    if (!openid) {
      return { code: -1, message: '用户openid不能为空' };
    }
    
    const userResult = await users.where({ openid }).get();
    
    if (userResult.data.length === 0) {
      return { code: -1, message: '用户不存在' };
    }
    
    const user = userResult.data[0];
    const now = new Date();
    
    let isMember = false;
    let membershipEndDate = null;
    let remainingDays = 0;
    
    if (user.membershipEndDate) {
      membershipEndDate = user.membershipEndDate;
      const endDate = new Date(membershipEndDate);
      
      if (endDate > now) {
        isMember = true;
        remainingDays = Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      }
    }
    
    return {
      code: 0,
      data: {
        isMember,
        membershipEndDate,
        remainingDays
      }
    };
  } catch (error) {
    console.error('获取用户会员信息失败:', error);
    return {
      code: -1,
      message: '获取用户会员信息失败',
      error: error.message
    };
  }
}