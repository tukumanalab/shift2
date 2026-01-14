// Google Apps Script用のJavaScriptコード
// このファイルをGoogle Apps Scriptエディタにコピー&ペーストしてください

// UUID生成関数
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// 設定値をプロパティサービスから取得
function getCalendarId() {
  const properties = PropertiesService.getScriptProperties();
  const calendarId = properties.getProperty('CALENDAR_ID');
  
  if (!calendarId) {
    throw new Error('CALENDAR_IDが設定されていません。Google Apps Scriptのプロパティサービスで設定してください。');
  }
  
  return calendarId;
}


function doGet(e) {
  try {
    const params = e.parameter;
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    // JSONP対応: callbackパラメータがある場合はJSONPレスポンスを返す
    const callback = params.callback;
    
    let responseData;
    
    if (params.type === 'loadCapacity') {
      // 人数設定データの読み込み
      const capacityData = loadCapacitySettings(spreadsheet);
      responseData = {success: true, data: capacityData};
        
    } else if (params.type === 'loadMyShifts' && params.userId) {
      // ユーザーのシフトデータの読み込み
      const shiftsData = loadUserShifts(spreadsheet, params.userId);
      responseData = {success: true, data: shiftsData};
        
    } else if (params.type === 'loadShiftCounts') {
      // シフト申請数の読み込み
      const shiftCounts = loadShiftCounts(spreadsheet);
      responseData = {success: true, data: shiftCounts};
        
    } else if (params.type === 'checkDuplicate' && params.userId && params.date && params.time) {
      // 単一時間枠の重複チェック
      const isDuplicate = checkDuplicateShift(spreadsheet, params.userId, params.date, params.time);
      responseData = {success: true, isDuplicate: isDuplicate};
        
    } else if (params.type === 'checkMultipleDuplicates' && params.userId && params.date && params.timeSlots) {
      // 複数時間枠の一括重複チェック
      const timeSlots = JSON.parse(params.timeSlots);
      const duplicateResults = checkMultipleDuplicates(spreadsheet, params.userId, params.date, timeSlots);
      responseData = {success: true, duplicates: duplicateResults};
    } else if (params.type === 'getUserProfile' && params.userId) {
      // ユーザープロフィールの取得
      const userProfile = getUserProfile(spreadsheet, params.userId);
      responseData = {success: true, data: userProfile};
    } else if (params.type === 'updateUserProfile' && params.userId) {
      // ユーザープロフィールの更新
      const result = updateUserProfile(spreadsheet, params.userId, params.nickname, params.realName);
      responseData = {success: result};
    } else if (params.type === 'loadSpecialShifts') {
      // 特別シフトデータの読み込み
      responseData = loadSpecialShifts(spreadsheet);
    } else if (params.type === 'getAllUsers') {
      // 全ユーザーデータの取得（移行用）
      const allUsers = getAllUsers(spreadsheet);
      responseData = {success: true, data: allUsers};
    } else {
      responseData = {success: false, error: 'Invalid request'};
    }
    
    // JSONP対応: callbackがある場合はJSONPレスポンス、ない場合は通常のJSONレスポンス
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(responseData) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(responseData))
        .setMimeType(ContentService.MimeType.JSON);
    }
      
  } catch (error) {
    const errorResponse = {success: false, error: error.toString()};
    const callback = e.parameter.callback;
    
    if (callback) {
      return ContentService
        .createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ');')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    } else {
      return ContentService
        .createTextOutput(JSON.stringify(errorResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
}

// CORS対応のためのOPTIONSリクエスト処理
function doOptions(e) {
  // OPTIONSリクエストには空のレスポンスを返す
  return ContentService
    .createTextOutput('')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    
    
    if (data.type === 'shift') {
      // 単一シフトデータの処理（従来の処理）
      const result = processSingleShiftRequest(spreadsheet, data);
      if (!result.success) {
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON)
          .setStatusCode(result.statusCode || 400);
      }
      
    } else if (data.type === 'submitShift') {
      // シフト申請処理（特別シフト含む）- 既存の通常シフト処理を使用
      if (data.timeSlots && data.timeSlots.length > 0) {
        // 時間範囲を30分区切りに変換
        const expandedTimeSlots = [];
        
        for (const timeSlot of data.timeSlots) {
          if (timeSlot.includes('-')) {
            // "07:30-09:30" のような範囲を30分区切りに分割
            const [startTime, endTime] = timeSlot.split('-');
            const thirtyMinSlots = convertToThirtyMinuteSlots(startTime, endTime);
            expandedTimeSlots.push(...thirtyMinSlots);
          } else {
            // 既に30分区切りの場合
            expandedTimeSlots.push(timeSlot);
          }
        }
        
        // processMultipleShiftRequestsに正しい形式でデータを渡す
        const multipleShiftData = {
          userId: data.userId,
          userName: data.userName,
          userEmail: data.userEmail || '',
          date: data.date,
          timeSlots: expandedTimeSlots,
          content: data.content || 'シフト'
        };
        
        const result = processMultipleShiftRequests(spreadsheet, multipleShiftData);
        
        return ContentService
          .createTextOutput(JSON.stringify(result))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        return ContentService
          .createTextOutput(JSON.stringify({success: false, error: 'No time slots provided'}))
          .setMimeType(ContentService.MimeType.JSON);
      }
        
    } else if (data.type === 'multipleShifts') {
      // 複数シフト申請の一括処理
      const results = processMultipleShiftRequests(spreadsheet, data);
      
      return ContentService
        .createTextOutput(JSON.stringify(results))
        .setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.type === 'deleteShift') {
      // シフト削除処理（管理者専用）
      const result = deleteShiftRequest(spreadsheet, data);
      
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
      
    } else if (data.type === 'capacity') {
      // 人数設定データの処理
      saveCapacitySettings(spreadsheet, data.data);
      
    } else if (data.type === 'loadCapacity') {
      // 人数設定データの読み込み
      const capacityData = loadCapacitySettings(spreadsheet);
      return ContentService
        .createTextOutput(JSON.stringify({success: true, data: capacityData}))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (data.type === 'syncAll') {
      // カレンダーから既存のシフトを削除してから全シフトを同期
      deleteAllShiftsFromCalendar();
      syncAllShiftsToCalendar();
      
    } else if (data.type === 'saveUser') {
      // ユーザーログインデータの処理
      saveUserData(spreadsheet, data);
      
    } else if (data.type === 'addSpecialShift') {
      // 特別シフトの追加
      const result = addSpecialShift(spreadsheet, data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
        
    } else if (data.type === 'deleteSpecialShift') {
      // 特別シフトの削除
      const result = deleteSpecialShift(spreadsheet, data);
      return ContentService
        .createTextOutput(JSON.stringify(result))
        .setMimeType(ContentService.MimeType.JSON);
      
    } else {
      throw new Error('不明なリクエストタイプ: ' + data.type);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({success: true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({success: false, error: error.toString()}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// 表示名を取得するヘルパー関数
function getDisplayName(nickname, realName, fallbackName) {
  const hasNickname = nickname && nickname.trim() !== '';
  const hasRealName = realName && realName.trim() !== '';
  
  if (hasNickname && hasRealName) {
    return nickname + '(' + realName + ')';
  } else if (hasNickname) {
    return nickname;
  } else if (hasRealName) {
    return realName;
  } else {
    return fallbackName || 'ユーザー';
  }
}

function addToCalendar(shiftData) {
  try {
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
    }
    
    Logger.log(`シフトデータを処理中: ${JSON.stringify(shiftData)}`);
    
    // 日付文字列の処理を改善
    let shiftDate;
    if (shiftData.date instanceof Date) {
      shiftDate = new Date(shiftData.date);
    } else if (typeof shiftData.date === 'string') {
      // YYYY-MM-DD形式の文字列を想定
      shiftDate = new Date(shiftData.date + 'T00:00:00');
    } else {
      throw new Error('無効な日付形式: ' + shiftData.date);
    }
    
    Logger.log(`解析された日付: ${shiftDate}`);
    
    // 時間情報を解析（例: "13:00-13:30"）
    const [startTime, endTime] = shiftData.time.split('-');
    const [startHour, startMinute] = startTime.trim().split(':').map(Number);
    const [endHour, endMinute] = endTime.trim().split(':').map(Number);
    
    Logger.log(`時間情報: ${startHour}:${startMinute} - ${endHour}:${endMinute}`);
    
    // 開始時刻と終了時刻のDateオブジェクトを作成
    const startDateTime = new Date(shiftDate);
    startDateTime.setHours(startHour, startMinute, 0, 0);
    
    const endDateTime = new Date(shiftDate);
    endDateTime.setHours(endHour, endMinute, 0, 0);
    
    Logger.log(`設定された開始時刻: ${startDateTime}`);
    Logger.log(`設定された終了時刻: ${endDateTime}`);
    
    // 表示名を取得
    const displayName = getDisplayName(shiftData.nickname, shiftData.realName, shiftData.userName);
    
    // イベントのタイトルと詳細を作成
    const title = displayName;
    const description = `担当者: ${displayName}
メール: ${shiftData.userEmail}
時間: ${shiftData.time}`;
    
    // カレンダーにイベントを追加（拡張プロパティでUUIDを保存）
    const event = calendar.createEvent(title, startDateTime, endDateTime, {
      description: description,
      location: 'つくまなラボ'  // 必要に応じて場所を設定
    });
    
    // 拡張プロパティでUUIDとユーザー情報を保存（カレンダー上では非表示）
    if (shiftData.uuid) {
      event.setTag('shift_uuid', shiftData.uuid);
      event.setTag('user_id', shiftData.userId);
      event.setTag('user_email', shiftData.userEmail);
      event.setTag('shift_time', shiftData.time);
      Logger.log(`UUID付きカレンダーイベントを作成: ${title}, UUID: ${shiftData.uuid}`);
    } else {
      Logger.log(`カレンダーイベントを作成しました: ${title} (${startDateTime} - ${endDateTime})`);
    }
    
  } catch (error) {
    Logger.log(`カレンダーへの追加に失敗しました: ${error.toString()}`);
    Logger.log(`シフトデータ: ${JSON.stringify(shiftData)}`);
    throw error;
  }
}


function loadCapacitySettings(spreadsheet) {
  try {
    // 「人数設定」シートを取得
    const capacitySheet = spreadsheet.getSheetByName('人数設定');
    
    if (!capacitySheet) {
      Logger.log(`「人数設定」シートが見つかりません`);
      return [];
    }
    
    // データを取得（ヘッダー行を除く）
    const data = capacitySheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('人数設定データがありません');
      return [];
    }
    
    // データを変換して返す
    const capacityData = data.slice(1).map(row => {
      let dateStr = '';
      try {
        // 日付の形式を統一
        const dateValue = row[1];
        if (dateValue instanceof Date) {
          dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof dateValue === 'string') {
          // 文字列の場合はそのまま使用（YYYY-MM-DD形式を想定）
          dateStr = dateValue;
        } else {
          // その他の場合は空文字列
          dateStr = '';
        }
      } catch (e) {
        dateStr = '';
      }
      
      return {
        date: dateStr,
        capacity: parseInt(row[2]) || 0,
        memo: row[5] || ''
      };
    }).filter(item => item.date !== ''); // 有効な日付のみ
    
    return capacityData;
    
  } catch (error) {
    return [];
  }
}

function saveCapacitySettings(spreadsheet, capacityData) {
  try {
    // 「人数設定」シートを取得または作成
    let capacitySheet = spreadsheet.getSheetByName('人数設定');
    
    if (!capacitySheet) {
      // シートが存在しない場合は作成して初期化
      capacitySheet = spreadsheet.insertSheet('人数設定');
      
      // ヘッダー行を追加
      capacitySheet.appendRow([
        '更新日時',
        '日付',
        '必要人数',
        '更新者ID',
        '更新者名',
        'メモ'
      ]);
      
      // 年度末までの全日付のデータを初期化
      initializeCapacityData(capacitySheet);
    }
    
    // 既存のデータから更新対象の日付のみ更新
    updateCapacityData(capacitySheet, capacityData);
    
    
  } catch (error) {
    throw error;
  }
}

function initializeCapacityData(capacitySheet) {
  try {
    const today = new Date();
    const currentYear = today.getFullYear();
    const nextYear = currentYear + 1;
    
    // 現在の月から来年度末（3月31日）まで
    let startDate = new Date(currentYear, today.getMonth(), 1);
    let endDate = new Date(nextYear, 3, 0); // 3月31日
    
    // もし現在が4月以降なら、今年度末まで
    if (today.getMonth() >= 3) {
      endDate = new Date(currentYear + 1, 3, 0);
    }
    
    const initData = [];
    let currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = Utilities.formatDate(currentDate, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      const dayOfWeek = currentDate.getDay();
      
      // デフォルトの人数を設定（日曜日=0, 月曜日=1, 火曜日=2, 水曜日=3, 木曜日=4, 金曜日=5, 土曜日=6）
      let defaultCapacity;
      switch (dayOfWeek) {
        case 0: // 日曜日
        case 6: // 土曜日
          defaultCapacity = 0;
          break;
        case 3: // 水曜日
          defaultCapacity = 2;
          break;
        default: // 月火木金
          defaultCapacity = 3;
          break;
      }
      
      initData.push([
        new Date(),
        dateStr,
        defaultCapacity,
        'system',
        'システム初期化',
        ''
      ]);
      
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // 一括でデータを追加
    if (initData.length > 0) {
      capacitySheet.getRange(2, 1, initData.length, 6).setValues(initData);
      Logger.log(`${initData.length}件の人数設定を初期化しました`);
    }
    
  } catch (error) {
    Logger.log('人数設定の初期化に失敗しました: ' + error.toString());
    throw error;
  }
}

function updateCapacityData(capacitySheet, capacityData) {
  try {
    // 既存のデータを取得
    const existingData = capacitySheet.getDataRange().getValues();
    const dataRows = existingData.slice(1);
    
    // 日付をキーとするマップを作成
    const dateRowMap = {};
    dataRows.forEach((row, index) => {
      const dateValue = row[1];
      let dateStr = '';
      
      if (dateValue instanceof Date) {
        dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
      } else if (typeof dateValue === 'string') {
        dateStr = dateValue;
      }
      
      if (dateStr) {
        dateRowMap[dateStr] = index + 2; // シートの行番号（1ベース、ヘッダー分+1）
      }
    });
    
    // 各データを更新
    capacityData.forEach(item => {
      const rowNumber = dateRowMap[item.date];
      if (rowNumber) {
        // 既存の行を更新
        capacitySheet.getRange(rowNumber, 1, 1, 6).setValues([[
          new Date(item.timestamp),
          item.date,
          item.capacity,
          item.userId,
          item.userName,
          item.memo || ''
        ]]);
      } else {
        // 新しい日付の場合は追加
        capacitySheet.appendRow([
          new Date(item.timestamp),
          item.date,
          item.capacity,
          item.userId,
          item.userName,
          item.memo || ''
        ]);
      }
    });
    
  } catch (error) {
    Logger.log('人数設定の更新に失敗しました: ' + error.toString());
    throw error;
  }
}

function saveUserData(spreadsheet, userData) {
  try {
    // 「ユーザー」シートを取得または作成
    let userSheet = spreadsheet.getSheetByName('ユーザー');
    
    if (!userSheet) {
      // シートが存在しない場合は作成
      userSheet = spreadsheet.insertSheet('ユーザー');
      
      // ヘッダー行を追加
      userSheet.appendRow([
        'タイムスタンプ',
        'ユーザーID',
        '名前',
        'メールアドレス',
        'プロフィール画像URL',
        'ニックネーム',
        '本名'
      ]);
    }
    
    // ユーザーIDが空の場合は追加しない
    if (!userData.sub) {
      Logger.log('ユーザーIDが空です');
      return;
    }
    
    // 既存のユーザーIDをチェック
    const existingData = userSheet.getDataRange().getValues();
    
    if (existingData.length > 1) {
      const existingUserIds = existingData.slice(1).map(row => row[1]); // B列のユーザーID
      
      // ユーザーIDが既に存在する場合は追加しない
      if (existingUserIds.includes(userData.sub)) {
        Logger.log('既存のユーザーです: ' + userData.sub);
        return;
      }
    }
    
    // 新しいユーザーデータを追加
    userSheet.appendRow([
      new Date(),
      userData.sub,
      userData.name,
      userData.email,
      userData.picture,
      '', // ニックネーム（初期値は空）
      ''  // 本名（初期値は空）
    ]);
    
    Logger.log('新規ユーザーを登録しました: ' + userData.email);
    
  } catch (error) {
    Logger.log('ユーザーデータの保存に失敗しました: ' + error.toString());
    throw error;
  }
}

function loadUserShifts(spreadsheet, userId) {
  try {
    // 「シフト」シートを取得
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      Logger.log(`「シフト」シートが見つかりません`);
      return [];
    }
    
    // ユーザー情報を取得（表示名とメールアドレスのため）
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    const userProfiles = {};
    
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      if (userData.length > 1) {
        // ヘッダー行をスキップしてユーザー情報をマップ化
        for (let i = 1; i < userData.length; i++) {
          const userRow = userData[i];
          if (userRow[1]) { // ユーザーIDが存在する場合
            userProfiles[userRow[1]] = {
              name: userRow[2] || '',      // C列: 名前
              email: userRow[3] || '',     // D列: メールアドレス
              nickname: userRow[5] || '',  // F列: ニックネーム
              realName: userRow[6] || ''   // G列: 本名
            };
          }
        }
      }
    }
    
    // データを取得（ヘッダー行を除く）
    const data = shiftSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('シフトデータがありません');
      return [];
    }
    
    // ユーザーのシフトデータをフィルタリング（管理者の場合は全員のデータを返す）
    const userShifts = data.slice(1).filter(row => {
      return row.length >= 4 && (userId === 'admin' || row[1] === userId); // 管理者または指定ユーザー
    }).map(row => {
      let dateStr = '';
      try {
        // 日付の形式を統一
        const dateValue = row[2]; // C列のシフト日付
        if (dateValue instanceof Date) {
          dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
        } else if (typeof dateValue === 'string') {
          dateStr = dateValue;
        }
      } catch (e) {
        Logger.log('日付の変換に失敗しました: ' + e.toString());
        dateStr = '';
      }
      
      const userProfile = userProfiles[row[1]] || {};
      const displayName = getDisplayName(userProfile.nickname, userProfile.realName, userProfile.name);
      
      return {
        registrationDate: row[0], // A列: 登録日時
        userId: row[1],          // B列: ユーザーID
        userName: row[4] || displayName,   // E列: 名前（なければ表示名）
        userEmail: userProfile.email || '', // メール（ユーザータブから取得）
        shiftDate: dateStr,      // C列: シフト日付
        timeSlot: row[3],        // D列: 時間帯
        content: 'シフト',       // 固定値
        nickname: userProfile.nickname || '', // ニックネーム
        realName: userProfile.realName || '', // 本名
        uuid: row[5] || ''       // F列: UUID
      };
    }).filter(item => item.shiftDate !== ''); // 有効な日付のみ
    
    // 日付でソート（古い順）
    userShifts.sort((a, b) => {
      const dateA = new Date(a.shiftDate);
      const dateB = new Date(b.shiftDate);
      return dateA - dateB;
    });
    
    Logger.log(`${userShifts.length}件のユーザーシフトを読み込みました`);
    return userShifts;
    
  } catch (error) {
    Logger.log('ユーザーシフトの読み込みに失敗しました: ' + error.toString());
    return [];
  }
}

function loadShiftCounts() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();

    // 「シフト」シートを取得
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      Logger.log(`「シフト」シートが見つかりません`);
      return {};
    }
    
    // データを取得（ヘッダー行を除く）
    const data = shiftSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      Logger.log('シフトデータがありません');
      return {};
    }
    
    // 日付と時間枠ごとのシフト申請数をカウント
    const shiftCounts = {};
    
    
    data.slice(1).forEach((row) => {
      if (row.length >= 4) {
        let dateStr = '';
        let timeSlot = '';
        try {
          // 日付の形式を統一（C列：シフト日付）
          const dateValue = row[2];
          if (dateValue instanceof Date) {
            dateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            dateStr = dateValue;
          }
          
          // 時間枠（D列）
          timeSlot = row[3] || '';
        } catch (e) {
          Logger.log('データの変換に失敗しました: ' + e.toString());
        }
        
        if (dateStr && timeSlot) {
          // 日付をキーとしたオブジェクトを初期化
          if (!shiftCounts[dateStr]) {
            shiftCounts[dateStr] = {};
          }
          
          // オブジェクトかどうか確認
          if (typeof shiftCounts[dateStr] !== 'object' || shiftCounts[dateStr] === null) {
            shiftCounts[dateStr] = {};
          }
          
          // 時間枠ごとのカウントを初期化
          if (!shiftCounts[dateStr][timeSlot]) {
            shiftCounts[dateStr][timeSlot] = 0;
          }
          shiftCounts[dateStr][timeSlot]++;
        }
      }
    });
    
    return shiftCounts;
    
  } catch (error) {
    Logger.log('シフト申請数の読み込みに失敗しました: ' + error.toString());
    return {};
  }
}

function syncAllShiftsToCalendar() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      throw new Error(`「シフト」シートが見つかりません`);
    }
    
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
    }
    
    // 既存のカレンダーイベントを削除（重複を防ぐため）
    const now = new Date();
    const futureDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1年後まで
    const events = calendar.getEvents(now, futureDate);
    
    // 「つくまなバイト2」関連のイベントを削除
    events.forEach(event => {
      if (event.getTitle().includes(' - ') && event.getDescription().includes('担当者:')) {
        event.deleteEvent();
      }
    });
    
    // ユーザー情報を取得（表示名のため）
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    const userProfiles = {};
    
    if (userSheet) {
      const userData = userSheet.getDataRange().getValues();
      if (userData.length > 1) {
        // ヘッダー行をスキップしてユーザー情報をマップ化
        for (let i = 1; i < userData.length; i++) {
          const userRow = userData[i];
          if (userRow[1]) { // ユーザーIDが存在する場合
            userProfiles[userRow[1]] = {
              name: userRow[2] || '',      // C列: 名前
              email: userRow[3] || '',     // D列: メールアドレス
              nickname: userRow[5] || '',  // F列: ニックネーム
              realName: userRow[6] || ''   // G列: 本名
            };
          }
        }
      }
    }

    // シフトデータを取得（ヘッダー行を除く）
    const shiftData = shiftSheet.getDataRange().getValues().slice(1);
    
    // ユーザーと日付ごとにシフトをグループ化
    const groupedShifts = {};
    
    shiftData.forEach(row => {
      if (row.length >= 4) {
        const userProfile = userProfiles[row[1]] || {};
        const shiftInfo = {
          userId: row[1],
          userName: getDisplayName(userProfile.nickname, userProfile.realName, userProfile.name),
          userEmail: userProfile.email || '',
          date: row[2],
          time: row[3],
          content: 'シフト',
          nickname: userProfile.nickname || '',
          realName: userProfile.realName || ''
        };
        
        // 日付が有効かチェック
        const shiftDate = new Date(shiftInfo.date);
        if (shiftDate >= now) { // 今日以降の予定のみ
          const key = `${shiftInfo.userId}_${shiftInfo.date}`;
          if (!groupedShifts[key]) {
            groupedShifts[key] = {
              userId: shiftInfo.userId,
              userName: shiftInfo.userName,
              userEmail: shiftInfo.userEmail,
              date: shiftInfo.date,
              timeSlots: [],
              content: shiftInfo.content,
              nickname: shiftInfo.nickname,
              realName: shiftInfo.realName
            };
          }
          groupedShifts[key].timeSlots.push(shiftInfo.time);
        }
      }
    });
    
    // 各グループについて時間帯をマージしてカレンダーに追加
    let syncCount = 0;
    Object.values(groupedShifts).forEach(group => {
      // 時間帯をソートして連続する時間帯をマージ
      const mergedTimeRanges = mergeConsecutiveTimeSlots(group.timeSlots);
      
      // マージされた各時間帯をカレンダーに追加
      mergedTimeRanges.forEach(timeRange => {
        const shiftInfo = {
          userId: group.userId,
          userName: group.userName,
          userEmail: group.userEmail,
          date: group.date,
          time: timeRange,
          content: group.content,
          nickname: group.nickname,
          realName: group.realName
        };
        addToCalendar(shiftInfo);
        syncCount++;
      });
    });
    
    Logger.log(`${syncCount}件のシフトをカレンダーに同期しました`);
    
  } catch (error) {
    Logger.log('一括同期に失敗しました: ' + error.toString());
    throw error;
  }
}

// カレンダーからすべてのシフト関連イベントを削除する関数
function deleteAllShiftsFromCalendar() {
  try {
    // カレンダーを取得
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
    }
    
    // 過去1年から未来1年までのイベントを取得
    const now = new Date();
    const pastDate = new Date(now.getTime() - (365 * 24 * 60 * 60 * 1000)); // 1年前
    const futureDate = new Date(now.getTime() + (365 * 24 * 60 * 60 * 1000)); // 1年後
    const events = calendar.getEvents(pastDate, futureDate);
    
    let deletedCount = 0;
    
    // シフト関連のイベントを削除
    events.forEach(event => {
      // シフト関連のイベントを識別（タイトルに「 - 」が含まれ、説明に「担当者:」が含まれる）
      if (event.getTitle().includes(' - ') && event.getDescription().includes('担当者:')) {
        event.deleteEvent();
        deletedCount++;
      }
    });
    
    Logger.log(`${deletedCount}件のシフト関連イベントをカレンダーから削除しました`);
    
  } catch (error) {
    Logger.log('カレンダーからのシフト削除に失敗しました: ' + error.toString());
    throw error;
  }
}

// テスト用：7/28の13:00-13:30にシフト申請を追加する関数
function addTestShiftFor728() {
  try {
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      throw new Error('「シフト」シートが見つかりません');
    }
    
    // テスト用のシフト申請を追加
    shiftSheet.appendRow([
      new Date(), // A列: 登録日時
      'test_user_id', // B列: ユーザーID
      'テストユーザー', // C列: ユーザー名
      'test@example.com', // D列: メールアドレス
      '2025-07-28', // E列: シフト日付
      '13:00-13:30', // F列: 時間帯
      'テスト用シフト' // G列: 内容
    ]);
    
    Logger.log('7/28の13:00-13:30にテスト用シフト申請を追加しました');
    
    // 追加後の状態を確認
    const result = loadShiftCounts(spreadsheet);
    Logger.log('追加後のシフト申請数:', JSON.stringify(result));
    
    return result;
  } catch (error) {
    Logger.log('テスト用シフト申請の追加に失敗しました: ' + error.toString());
    throw error;
  }
}

// 重複チェック専用関数
function checkDuplicateShift(spreadsheet, userId, date, time) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return false; // シートが存在しない場合は重複なし
    }
    
    const existingData = shiftSheet.getDataRange().getValues();
    
    if (existingData.length <= 1) {
      return false; // データがない場合は重複なし
    }
    
    // 重複チェック
    const isDuplicate = existingData.slice(1).some(row => {
      let rowDateStr = '';
      try {
        const dateValue = row[2]; // C列: date
        if (dateValue instanceof Date) {
          rowDateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
          rowDateStr = dateValue;
        }
      } catch (e) {
        rowDateStr = '';
      }
      
      return row[1] === userId && // B列: userId
             rowDateStr === date && 
             row[3] === time; // D列: time
    });
    
    return isDuplicate;
    
  } catch (error) {
    Logger.log('重複チェックでエラーが発生しました: ' + error.toString());
    return false; // エラーの場合は重複なしとして扱う
  }
}

// 単一シフト申請の処理
function processSingleShiftRequest(spreadsheet, data) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {
        success: false,
        error: 'sheet_not_found',
        message: '「シフト」シートが見つかりません'
      };
    }
    
    // ユーザープロフィールを取得して表示名を決定
    const userProfile = getUserProfile(spreadsheet, data.userId);
    let displayName = data.userName; // デフォルトは元の名前
    
    if (userProfile) {
      displayName = getDisplayName(userProfile.nickname, userProfile.realName, data.userName);
    }
    
    // 重複チェック：同じユーザーが同じ日の同じ時間帯に既に申請していないか確認
    const existingData = shiftSheet.getDataRange().getValues();
    
    if (existingData.length > 1) { // ヘッダー行を除く
      const isDuplicate = existingData.slice(1).some(row => {
        // B列: userId, C列: date, D列: time
        let rowDateStr = '';
        try {
          // C列の日付をYYYY-MM-DD形式に変換
          const dateValue = row[2];
          if (dateValue instanceof Date) {
            rowDateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            rowDateStr = dateValue;
          }
        } catch (e) {
          rowDateStr = '';
        }
        
        return row[1] === data.userId && 
               rowDateStr === data.date && 
               row[3] === data.time;
      });
      
      if (isDuplicate) {
        return {
          success: false,
          error: 'duplicate',
          message: `${data.date}の${data.time}は既に申請済みです。`,
          statusCode: 409
        };
      }
    }
    
    // UUIDを生成
    const uuid = generateUUID();
    
    // シフトデータを追加（ユーザーIDと名前を保存）
    shiftSheet.appendRow([
      new Date(),
      data.userId,
      data.date,
      data.time,
      data.userName,  // E列: 名前
      uuid           // F列: UUID
    ]);
    
    // Google Calendarに予定を追加（表示名とUUIDを使用）
    const calendarData = {
      ...data,
      userName: displayName,
      nickname: userProfile ? userProfile.nickname : '',
      realName: userProfile ? userProfile.realName : '',
      uuid: uuid
    };
    addToCalendar(calendarData);
    
    return { success: true };
    
  } catch (error) {
    Logger.log('単一シフト申請の処理でエラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: 'シフト申請の処理中にエラーが発生しました'
    };
  }
}

// 複数シフト申請の一括処理
function processMultipleShiftRequests(spreadsheet, requestData) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {
        success: false,
        error: 'sheet_not_found',
        message: '「シフト」シートが見つかりません',
        processed: [],
        duplicates: [],
        errors: []
      };
    }
    
    const { userId, userName, userEmail, date, timeSlots, content } = requestData;
    const results = {
      success: true,
      processed: [],
      duplicates: [],
      errors: []
    };
    
    // ユーザープロフィールを取得して表示名を決定
    const userProfile = getUserProfile(spreadsheet, userId);
    let displayName = userName; // デフォルトは元の名前
    
    if (userProfile) {
      displayName = getDisplayName(userProfile.nickname, userProfile.realName, userName);
    }
    
    // 入力検証
    if (!Array.isArray(timeSlots) || timeSlots.length === 0) {
      return {
        success: false,
        error: 'invalid_input',
        message: 'timeSlots配列が必要です',
        processed: [],
        duplicates: [],
        errors: []
      };
    }
    
    // まず全ての時間枠の重複チェックを一括で行う
    const duplicateResults = checkMultipleDuplicates(spreadsheet, userId, date, timeSlots);
    
    // 重複していない時間枠のみを処理
    const validTimeSlots = timeSlots.filter(timeSlot => !duplicateResults[timeSlot]);
    const duplicateTimeSlots = timeSlots.filter(timeSlot => duplicateResults[timeSlot]);
    
    results.duplicates = duplicateTimeSlots;
    
    // 有効な時間枠を一括でスプレッドシートに追加
    if (validTimeSlots.length > 0) {
      const rowsToAdd = validTimeSlots.map(timeSlot => {
        const uuid = generateUUID();
        return [
          new Date(),
          userId,
          date,
          timeSlot,
          userName,  // E列: 名前
          uuid       // F列: UUID
        ];
      });
      
      // 一括でデータを追加（パフォーマンス向上）
      const range = shiftSheet.getRange(shiftSheet.getLastRow() + 1, 1, rowsToAdd.length, 6);
      range.setValues(rowsToAdd);
      
      results.processed = validTimeSlots;
      
      // Google Calendarに予定を追加（連続する時間帯をマージして）
      try {
        const mergedTimeRanges = mergeConsecutiveTimeSlots(validTimeSlots);
        
        mergedTimeRanges.forEach((timeRange) => {
          try {
            // 複数のUUIDがある場合は最初のものを使用
            const matchingUuid = rowsToAdd.find(rowData => validTimeSlots.some(slot => 
              timeRange.includes(slot.split('-')[0])
            ))?.[5] || generateUUID();
            
            addToCalendar({
              userId,
              userName: displayName, // 表示名を使用
              userEmail,
              date,
              time: timeRange,
              content: content || 'シフト',
              nickname: userProfile ? userProfile.nickname : '',
              realName: userProfile ? userProfile.realName : '',
              uuid: matchingUuid
            });
          } catch (calendarError) {
            Logger.log(`カレンダー追加エラー (${timeRange}): ${calendarError.toString()}`);
            results.errors.push(`カレンダー追加に失敗: ${timeRange}`);
          }
        });
      } catch (mergeError) {
        Logger.log(`時間範囲マージエラー: ${mergeError.toString()}`);
        // マージに失敗した場合は個別に追加
        validTimeSlots.forEach((timeSlot, index) => {
          try {
            const matchingUuid = rowsToAdd[index]?.[5] || generateUUID();
            addToCalendar({
              userId,
              userName,
              userEmail,
              date,
              time: timeSlot,
              content: content || 'シフト',
              uuid: matchingUuid
            });
          } catch (calendarError) {
            Logger.log(`カレンダー追加エラー (${timeSlot}): ${calendarError.toString()}`);
            results.errors.push(`カレンダー追加に失敗: ${timeSlot}`);
          }
        });
      }
    }
    
    return results;
    
  } catch (error) {
    Logger.log('複数シフト申請の処理でエラーが発生しました: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: '複数シフト申請の処理中にエラーが発生しました',
      processed: [],
      duplicates: [],
      errors: [error.toString()]
    };
  }
}

// 複数時間枠の一括重複チェック
function checkMultipleDuplicates(spreadsheet, userId, date, timeSlots) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {}; // シートが存在しない場合は重複なし
    }
    
    const existingData = shiftSheet.getDataRange().getValues();
    
    if (existingData.length <= 1) {
      return {}; // データがない場合は重複なし
    }
    
    const duplicates = {};
    
    // 各時間枠について重複をチェック
    timeSlots.forEach(timeSlot => {
      const isDuplicate = existingData.slice(1).some(row => {
        let rowDateStr = '';
        try {
          const dateValue = row[2]; // C列: date
          if (dateValue instanceof Date) {
            rowDateStr = Utilities.formatDate(dateValue, Session.getScriptTimeZone(), 'yyyy-MM-dd');
          } else if (typeof dateValue === 'string') {
            rowDateStr = dateValue;
          }
        } catch (e) {
          rowDateStr = '';
        }
        
        return row[1] === userId && // B列: userId
               rowDateStr === date && 
               row[3] === timeSlot; // D列: time
      });
      
      duplicates[timeSlot] = isDuplicate;
    });
    
    return duplicates;
    
  } catch (error) {
    Logger.log('一括重複チェックでエラーが発生しました: ' + error.toString());
    return {};
  }
}

// シフト削除処理（管理者専用）
function deleteShiftRequest(spreadsheet, data) {
  try {
    const shiftSheet = spreadsheet.getSheetByName('シフト');
    
    if (!shiftSheet) {
      return {
        success: false,
        error: 'sheet_not_found',
        message: '「シフト」シートが見つかりません'
      };
    }
    
    // UUIDまたはUUID配列が必須
    const uuids = data.uuids || (data.uuid ? [data.uuid] : []);
    if (uuids.length === 0) {
      return {
        success: false,
        error: 'uuid_required',
        message: 'UUIDが必要です'
      };
    }
    
    const allData = shiftSheet.getDataRange().getValues();
    const deletedRows = [];
    
    // UUID配列で検索して削除
    Logger.log('UUIDベース削除: ' + JSON.stringify(uuids));
    for (let i = 1; i < allData.length; i++) {
      const row = allData[i];
      const rowUuid = row[5]; // F列: UUID
      
      if (uuids.includes(rowUuid)) {
        const timeSlot = row[3]; // D列: 時間帯
        const userId = row[1]; // B列: ユーザーID
        const userEmail = row[4]; // E列: ユーザー名（メールから取得可能）
        const date = row[2]; // C列: シフト日付
        
        deletedRows.push({ 
          index: i + 1, 
          timeSlot: timeSlot,
          uuid: rowUuid,
          userId: userId,
          userEmail: userEmail,
          date: date
        });
        Logger.log(`UUIDで削除対象発見: ${rowUuid}, 時間帯: ${timeSlot}`);
      }
    }
    
    if (deletedRows.length === 0) {
      return {
        success: false,
        error: 'not_found',
        message: '該当するシフトが見つかりません'
      };
    }
    
    // 行番号を降順でソートして削除（後ろから削除することで行番号のずれを防ぐ）
    deletedRows.sort((a, b) => b.index - a.index);
    
    // 行を削除
    for (const deleteInfo of deletedRows) {
      shiftSheet.deleteRow(deleteInfo.index);
    }
    
    // Google Calendarからも削除（UUIDで削除）
    for (const deleteInfo of deletedRows) {
      try {
        deleteFromCalendar({
          userId: deleteInfo.userId,
          userName: '', // 不要だがdeleteFromCalendar関数の互換性のため
          userEmail: deleteInfo.userEmail,
          date: deleteInfo.date,
          time: deleteInfo.timeSlot,
          uuid: deleteInfo.uuid
        });
      } catch (calendarError) {
        Logger.log('カレンダーからの削除に失敗: ' + calendarError.toString());
        // カレンダー削除の失敗は警告のみ
      }
    }
    
    return {
      success: true,
      message: `${deletedRows.length}件のシフトを削除しました`,
      deletedCount: deletedRows.length
    };
    
  } catch (error) {
    Logger.log('シフト削除処理でエラー: ' + error.toString());
    return {
      success: false,
      error: error.toString(),
      message: 'シフト削除中にエラーが発生しました'
    };
  }
}

// 連続する時間帯をマージする関数
function mergeConsecutiveTimeSlots(timeSlots) {
  if (timeSlots.length === 0) return [];
  
  // 時間帯を開始時刻でソート
  const sorted = timeSlots.sort((a, b) => {
    const timeA = a.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
    const timeB = b.replace(/(\d+):(\d+)-(\d+):(\d+)/, '$1$2');
    return parseInt(timeA) - parseInt(timeB);
  });
  
  const merged = [];
  let currentStart = sorted[0].split('-')[0];
  let currentEnd = sorted[0].split('-')[1];
  
  for (let i = 1; i < sorted.length; i++) {
    const [nextStart, nextEnd] = sorted[i].split('-');
    
    // 現在の終了時刻と次の開始時刻が一致すれば連続
    if (currentEnd === nextStart) {
      currentEnd = nextEnd;
    } else {
      // 連続していない場合は現在の範囲を保存して新しい範囲を開始
      merged.push(`${currentStart}-${currentEnd}`);
      currentStart = nextStart;
      currentEnd = nextEnd;
    }
  }
  
  // 最後の範囲を追加
  merged.push(`${currentStart}-${currentEnd}`);
  
  return merged;
}

// Google Calendarからシフトを削除する関数
function deleteFromCalendar(shiftData) {
  try {
    const calendar = CalendarApp.getCalendarById(getCalendarId());
    
    if (!calendar) {
      throw new Error('カレンダーが見つかりません: ' + getCalendarId());
    }
    
    // 該当する日付のイベントを検索
    const shiftDate = new Date(shiftData.date);
    const startDate = new Date(shiftDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(shiftDate);
    endDate.setHours(23, 59, 59, 999);
    
    const events = calendar.getEvents(startDate, endDate);
    
    // UUIDがある場合は拡張プロパティで検索、ない場合は従来の方法
    Logger.log(`削除対象検索中: UUID=${shiftData.uuid}, ユーザー=${shiftData.userName}, メール=${shiftData.userEmail}, 時間=${shiftData.time}`);
    
    events.forEach(event => {
      const eventTitle = event.getTitle();
      const eventDescription = event.getDescription();
      
      // UUIDが指定されている場合は拡張プロパティで検索（推奨）
      if (shiftData.uuid) {
        const eventUuid = event.getTag('shift_uuid');
        if (eventUuid === shiftData.uuid) {
          event.deleteEvent();
          Logger.log(`UUIDでカレンダーイベントを削除: ${eventTitle}, UUID: ${eventUuid}`);
          return;
        }
      }
      
      // UUIDがない場合は従来の方法で検索（後方互換性）
      Logger.log(`イベント確認: タイトル="${eventTitle}", 説明="${eventDescription}"`);
      if (eventDescription.includes(shiftData.userEmail) &&
          eventDescription.includes(shiftData.time)) {
        event.deleteEvent();
        Logger.log('従来方式でカレンダーイベントを削除: ' + eventTitle);
      }
    });
    
  } catch (error) {
    Logger.log('カレンダーからの削除に失敗しました: ' + error.toString());
    throw error;
  }
}


// ユーザープロフィールを取得する関数
function getUserProfile(spreadsheet, userId) {
  try {
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    
    if (!userSheet) {
      return null;
    }
    
    const data = userSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return null;
    }
    
    // ヘッダー行をスキップして、ユーザーIDで検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) { // B列: ユーザーID
        return {
          nickname: data[i][5] || '', // F列: ニックネーム
          realName: data[i][6] || ''   // G列: 本名
        };
      }
    }
    
    return null;
    
  } catch (error) {
    Logger.log('ユーザープロフィールの取得に失敗しました: ' + error.toString());
    return null;
  }
}

// ユーザープロフィールを更新する関数
function updateUserProfile(spreadsheet, userId, nickname, realName) {
  try {
    const userSheet = spreadsheet.getSheetByName('ユーザー');
    
    if (!userSheet) {
      return false;
    }
    
    const data = userSheet.getDataRange().getValues();
    
    if (data.length <= 1) {
      return false;
    }
    
    // ヘッダー行をスキップして、ユーザーIDで検索
    for (let i = 1; i < data.length; i++) {
      if (data[i][1] === userId) { // B列: ユーザーID
        // F列（ニックネーム）とG列（本名）を更新
        userSheet.getRange(i + 1, 6).setValue(nickname || ''); // F列
        userSheet.getRange(i + 1, 7).setValue(realName || '');  // G列
        
        Logger.log('ユーザープロフィールを更新しました: ' + userId);
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    Logger.log('ユーザープロフィールの更新に失敗しました: ' + error.toString());
    return false;
  }
}

// 特別シフトデータを読み込む関数
function loadSpecialShifts(spreadsheet) {
  try {
    Logger.log('=== loadSpecialShifts DEBUG ===');
    
    const specialShiftSheet = spreadsheet.getSheetByName('特別シフト');
    
    if (!specialShiftSheet) {
      Logger.log('特別シフトシートが存在しません');
      return {
        success: true,
        data: [],
        message: '特別シフトシートが存在しません（空のデータを返します）'
      };
    }
    
    const lastRow = specialShiftSheet.getLastRow();
    if (lastRow <= 1) {
      Logger.log('特別シフトデータがありません（ヘッダーのみ）');
      return {
        success: true,
        data: []
      };
    }
    
    // ヘッダーを除いたデータ範囲を取得（新しい構造: UUID, 日付, 開始時刻, 終了時刻, 更新者ID, 更新者名, 更新日時）
    const dataRange = specialShiftSheet.getRange(2, 1, lastRow - 1, 7);
    const data = dataRange.getValues();
    
    Logger.log('読み込んだ行数:', data.length);
    
    const specialShifts = data.map((row, index) => {
      // 日付の正規化処理（タイムゾーンのずれを修正）
      let normalizedDate = row[1];
      
      if (normalizedDate instanceof Date) {
        // Dateオブジェクトの場合は、JSTでの日付文字列に変換
        // getFullYear(), getMonth(), getDate()はローカル時間を返すので安全
        const year = normalizedDate.getFullYear();
        const month = String(normalizedDate.getMonth() + 1).padStart(2, '0');
        const day = String(normalizedDate.getDate()).padStart(2, '0');
        normalizedDate = `${year}-${month}-${day}`;
        Logger.log('日付変換: Date object -> ' + normalizedDate);
      } else if (typeof normalizedDate === 'string' && normalizedDate.includes('T')) {
        // ISO形式の場合は日付部分のみを抽出
        normalizedDate = normalizedDate.split('T')[0];
        Logger.log('日付変換: ISO string -> ' + normalizedDate);
      }
      
      const shift = {
        uuid: row[0],                    // UUID
        date: normalizedDate,            // 正規化された日付
        startTime: row[2],               // 開始時刻
        endTime: row[3],                 // 終了時刻
        userId: row[4],                  // 更新者ID
        userName: row[5],                // 更新者名
        updatedAt: row[6]                // 更新日時
      };
      
      Logger.log('行' + (index + 2) + ':', {
        uuid: shift.uuid,
        date: shift.date,
        originalDate: row[1],
        dateType: typeof row[1],
        startTime: shift.startTime,
        endTime: shift.endTime,
        userId: shift.userId,
        userName: shift.userName,
        updatedAt: shift.updatedAt
      });
      
      return shift;
    });
    
    Logger.log('特別シフトデータ読み込み完了:', specialShifts.length + '件');
    
    return {
      success: true,
      data: specialShifts
    };
    
  } catch (error) {
    Logger.log('特別シフト読み込みエラー: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 特別シフトを追加する関数
function addSpecialShift(spreadsheet, data) {
  try {
    Logger.log('=== addSpecialShift DEBUG ===');
    Logger.log('受信データ:', JSON.stringify(data));
    
    let specialShiftSheet = spreadsheet.getSheetByName('特別シフト');
    
    // シートが存在しない場合は作成
    if (!specialShiftSheet) {
      specialShiftSheet = spreadsheet.insertSheet('特別シフト');
      // ヘッダー行を設定（新しい構造）
      specialShiftSheet.getRange(1, 1, 1, 7).setValues([
        ['UUID', '日付', '開始時刻', '終了時刻', '更新者ID', '更新者名', '更新日時']
      ]);
      Logger.log('特別シフトシートを作成しました');
    }
    
    // UUIDを生成
    const uuid = Utilities.getUuid();
    Logger.log('生成されたUUID:', uuid);
    
    const now = new Date();
    
    // 更新者情報を取得（フィールド名を確認）
    const userId = data.updaterId || data.userId || '';
    const userName = data.updaterName || data.userName || '';
    
    Logger.log('更新者情報:', { userId, userName });
    
    // 新しい行を追加（新しい構造に合わせて）
    const newRow = [
      uuid,                    // UUID
      data.date,              // 日付
      data.startTime,         // 開始時刻
      data.endTime,           // 終了時刻
      userId,                 // 更新者ID
      userName,               // 更新者名
      now                     // 更新日時
    ];
    
    Logger.log('追加する行データ:', newRow);
    
    specialShiftSheet.appendRow(newRow);
    
    Logger.log('特別シフトを追加しました');
    
    return {
      success: true,
      message: '特別シフトが正常に追加されました',
      uuid: uuid
    };
    
  } catch (error) {
    Logger.log('特別シフトの追加に失敗しました: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 特別シフトを削除する関数
function deleteSpecialShift(spreadsheet, data) {
  try {
    Logger.log('=== deleteSpecialShift DEBUG ===');
    Logger.log('削除リクエストデータ:', JSON.stringify(data));
    
    const specialShiftSheet = spreadsheet.getSheetByName('特別シフト');
    
    if (!specialShiftSheet) {
      return {
        success: false,
        error: '特別シフトシートが見つかりません'
      };
    }
    
    const sheetData = specialShiftSheet.getDataRange().getValues();
    Logger.log('シートデータ行数:', sheetData.length);
    
    // UUIDが提供されている場合はUUIDで削除
    if (data.uuid) {
      Logger.log('UUIDベースで削除:', data.uuid);
      
      for (let i = sheetData.length - 1; i >= 1; i--) {
        const row = sheetData[i];
        const rowUuid = row[0]; // 新しい構造では0列目がUUID
        
        Logger.log('行' + (i+1) + ' UUID:', rowUuid);
        
        if (rowUuid === data.uuid) {
          Logger.log('一致するUUIDを発見: ' + (i+1));
          specialShiftSheet.deleteRow(i + 1);
          Logger.log('特別シフトを削除しました (UUID: ' + data.uuid + ')');
          
          return {
            success: true,
            message: '特別シフトを削除しました'
          };
        }
      }
      
      Logger.log('該当するUUIDが見つかりませんでした');
      return {
        success: false,
        error: '該当する特別シフトが見つかりませんでした (UUID: ' + data.uuid + ')'
      };
    }
    
    // UUIDがない場合は従来の方法で削除（日付+時間での一致）
    Logger.log('日付・時間ベースで削除');
    
    for (let i = sheetData.length - 1; i >= 1; i--) {
      const row = sheetData[i];
      
      Logger.log('行' + (i+1) + ':', {
        date: row[1],      // 日付
        startTime: row[2], // 開始時刻
        endTime: row[3],   // 終了時刻
        dateType: typeof row[1],
        startTimeType: typeof row[2],
        endTimeType: typeof row[3]
      });
      
      // 日付の比較
      let sheetDate = row[1];
      if (sheetDate instanceof Date) {
        const year = sheetDate.getFullYear();
        const month = String(sheetDate.getMonth() + 1).padStart(2, '0');
        const day = String(sheetDate.getDate()).padStart(2, '0');
        sheetDate = `${year}-${month}-${day}`;
      } else if (typeof sheetDate === 'string' && sheetDate.includes('T')) {
        sheetDate = sheetDate.split('T')[0];
      }
      
      // 時間の比較
      let sheetStartTime = row[2];
      let sheetEndTime = row[3];
      
      if (sheetStartTime instanceof Date) {
        const hours = String(sheetStartTime.getHours()).padStart(2, '0');
        const minutes = String(sheetStartTime.getMinutes()).padStart(2, '0');
        sheetStartTime = `${hours}:${minutes}`;
      } else if (typeof sheetStartTime === 'string' && sheetStartTime.includes('T')) {
        const utcDate = new Date(sheetStartTime);
        const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
        const hours = String(jstDate.getUTCHours()).padStart(2, '0');
        const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
        sheetStartTime = `${hours}:${minutes}`;
      }
      
      if (sheetEndTime instanceof Date) {
        const hours = String(sheetEndTime.getHours()).padStart(2, '0');
        const minutes = String(sheetEndTime.getMinutes()).padStart(2, '0');
        sheetEndTime = `${hours}:${minutes}`;
      } else if (typeof sheetEndTime === 'string' && sheetEndTime.includes('T')) {
        const utcDate = new Date(sheetEndTime);
        const jstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
        const hours = String(jstDate.getUTCHours()).padStart(2, '0');
        const minutes = String(jstDate.getUTCMinutes()).padStart(2, '0');
        sheetEndTime = `${hours}:${minutes}`;
      }
      
      Logger.log('正規化後 - シートデータ:', {
        date: sheetDate,
        startTime: sheetStartTime,
        endTime: sheetEndTime
      });
      
      // 正規化したデータで比較
      if (sheetDate === data.date && 
          sheetStartTime === data.startTime && 
          sheetEndTime === data.endTime) {
        Logger.log('一致する行を発見: ' + (i+1));
        specialShiftSheet.deleteRow(i + 1);
        Logger.log('特別シフトを削除しました: ' + data.date + ' ' + data.startTime + '-' + data.endTime);
        
        return {
          success: true,
          message: '特別シフトを削除しました'
        };
      }
    }
    
    Logger.log('該当する特別シフトが見つかりませんでした');
    return {
      success: false,
      error: '該当する特別シフトが見つかりませんでした'
    };
    
  } catch (error) {
    Logger.log('特別シフトの削除に失敗しました: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// シフト申請を処理する関数（特別シフト対応）
function processShiftSubmission(spreadsheet, data) {
  try {
    Logger.log('=== processShiftSubmission DEBUG ===');
    Logger.log('受信データ:', JSON.stringify(data));
    
    const shiftsSheet = spreadsheet.getSheetByName('シフト');
    if (!shiftsSheet) {
      return {
        success: false,
        error: 'シフトシートが見つかりません'
      };
    }
    
    const results = [];
    
    // timeSlots配列内の各時間帯を処理
    for (const timeSlot of data.timeSlots) {
      Logger.log('処理中の時間帯:', timeSlot);
      
      // 時間帯が "HH:MM-HH:MM" 形式の場合は30分区切りに変換
      let timeSlotList;
      if (timeSlot.includes('-')) {
        const [startTime, endTime] = timeSlot.split('-');
        timeSlotList = convertToThirtyMinuteSlots(startTime, endTime);
        Logger.log('30分区切りに変換:', timeSlotList);
      } else {
        timeSlotList = [timeSlot];
      }
      
      // 各30分スロットをシートに追加
      for (const slot of timeSlotList) {
        const uuid = generateUUID();
        const newRow = [
          new Date(),           // A列: 登録日時
          data.userId,          // B列: ユーザーID
          data.date,            // C列: シフト日付
          slot,                 // D列: 時間帯
          data.userName || '',  // E列: 名前
          uuid                  // F列: UUID
        ];
        
        shiftsSheet.appendRow(newRow);
        Logger.log('シフトを追加（UUID付き）:', newRow);
        
        // Google Calendarにも追加（UUID付き、特別シフトの場合はcontentなし）
        try {
          addToCalendar({
            userId: data.userId,
            userName: data.userName || '',
            userEmail: data.userEmail || '', // リクエストから取得
            date: data.date,
            time: slot,
            content: 'シフト',  // 特別シフトでもcontentは固定値
            uuid: uuid  // UUIDを追加
          });
          Logger.log(`カレンダーに追加完了: ${slot}, UUID: ${uuid}`);
        } catch (calendarError) {
          Logger.log(`カレンダー追加エラー (${slot}): ${calendarError.toString()}`);
        }
        
        results.push({ timeSlot: slot, success: true, uuid: uuid });
      }
    }
    
    Logger.log('シフト申請処理完了:', results.length + '件');
    
    return {
      success: true,
      message: 'シフトを申請しました',
      results: results
    };
    
  } catch (error) {
    Logger.log('シフト申請処理エラー: ' + error.toString());
    return {
      success: false,
      error: error.toString()
    };
  }
}

// 全ユーザーデータを取得する関数（移行用）
function getAllUsers(spreadsheet) {
  try {
    const userSheet = spreadsheet.getSheetByName('ユーザー');

    if (!userSheet) {
      Logger.log('「ユーザー」シートが見つかりません');
      return [];
    }

    const data = userSheet.getDataRange().getValues();

    if (data.length <= 1) {
      Logger.log('ユーザーデータがありません');
      return [];
    }

    // ヘッダー行をスキップしてユーザーデータを変換
    const users = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];

      // タイムスタンプの変換
      let createdAt = '';
      try {
        if (row[0] instanceof Date) {
          createdAt = Utilities.formatDate(row[0], Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
        } else if (row[0]) {
          createdAt = row[0].toString();
        }
      } catch (e) {
        Logger.log('タイムスタンプの変換エラー: ' + e.toString());
      }

      users.push({
        timestamp: createdAt,           // A列: タイムスタンプ
        userId: row[1] || '',            // B列: ユーザーID
        name: row[2] || '',              // C列: 名前
        email: row[3] || '',             // D列: メールアドレス
        picture: row[4] || '',           // E列: プロフィール画像URL
        nickname: row[5] || '',          // F列: ニックネーム
        realName: row[6] || ''           // G列: 本名
      });
    }

    Logger.log(users.length + '件のユーザーデータを取得しました');
    return users;

  } catch (error) {
    Logger.log('全ユーザーデータの取得に失敗しました: ' + error.toString());
    return [];
  }
}

// 時間帯を30分区切りのスロットに変換する関数
function convertToThirtyMinuteSlots(startTime, endTime) {
  const slots = [];
  
  // 時間を分に変換
  function timeToMinutes(time) {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }
  
  // 分を時間に変換
  function minutesToTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  }
  
  const startMinutes = timeToMinutes(startTime);
  const endMinutes = timeToMinutes(endTime);
  
  // 30分刻みでスロットを生成
  for (let current = startMinutes; current < endMinutes; current += 30) {
    const slotStart = minutesToTime(current);
    const slotEnd = minutesToTime(current + 30);
    slots.push(`${slotStart}-${slotEnd}`);
  }
  
  return slots;
}
