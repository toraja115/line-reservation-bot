const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// ✅ ① スケジュール自動生成関数
function generateSchedule(rules, weeksAhead = 3) {
  const slots = [];
  const dayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  const today = new Date();
  const endDate = new Date(today);
  endDate.setDate(today.getDate() + (weeksAhead * 7));

  for (let date = new Date(today); date <= endDate; date.setDate(date.getDate() + 1)) {
    const weekday = dayName[date.getDay()];
    const rule = rules[weekday];

    if (rule) {
      for (let hour = rule.start; hour < rule.end; hour++) {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const timeSlot = {
          date: `${yyyy}-${mm}-${dd}`,
          time: `${String(hour).padStart(2, '0')}:00-${String(hour + 1).padStart(2, '0')}:00`
        };
        slots.push(timeSlot);
      }
    }
  }

  return slots;
}
// 日本語で日付を「5月7日（水曜日）」形式にする
function formatJapaneseDate(dateStr) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  const weekDays = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  const wday = weekDays[dateObj.getDay()];
  return `${month}月${day}日（${wday}）`;
}

// ✅ ② スケジュールのルールを定義
const rules = {
  Tuesday: { start: 13, end: 22 },    // 火曜 13〜22時
  Wednesday: { start: 11, end: 20 }   // 水曜 11〜20時
};

// ✅ ③ スロット生成（毎回動的に）
app.post('/webhook', (req, res) => {
  console.log('受信したリクエスト:', req.body);

  const events = req.body.events;
  if (events && events.length > 0) {
    const event = events[0];
    if (event.type === 'message' && event.message.type === 'text') {
      console.log('受信メッセージ:', event.message.text);

      // ✅ 予約完了処理
      if (event.message.text.includes('を予約したい')) {
        const replyMessage = {
          replyToken: event.replyToken,
          messages: [
            {
              type: 'text',
              text: 'ご予約を受け付けました！TORAJAからの連絡をお待ちください✨'
            }
          ]
        };

        axios.post('https://api.line.me/v2/bot/message/reply', replyMessage, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer 85xLK5WKC4Dfl64wKRhWVlzwnjCycLbLpIhLuOreNOIjN3w5zhpe6bCmpzO3U15y55gFZqmJSyIUv81QaI6Remtq99Bda5ByxH7PZhz3aJsEZi75vBWNCviLzYtA4fuieXhSQEGiBhqAx8l1QgfNxQdB04t89/1O/w1cDnyilFU=`
          }
        })
        .then(response => {
          console.log('予約完了メッセージ送信成功:', response.data);
        })
        .catch(error => {
          console.error('予約完了メッセージ送信失敗:', error.response ? error.response.data : error.message);
        });

      } else if (event.message.text === '予約') {
        // ✅ 当日以降のスロットを生成
        const availableSlots = generateSchedule(rules, 3);
        const now = new Date();
        const futureSlots = availableSlots.filter(slot => {
          const [year, month, day] = slot.date.split('-').map(Number);
          const slotDate = new Date(year, month - 1, day);
          return slotDate >= new Date(now.getFullYear(), now.getMonth(), now.getDate());
        });

        // ✅ 最大10件のカルーセルに変換
        const carouselColumns = [];
        for (let i = 0; i < Math.min(futureSlots.length, 30); i += 3) {
          const chunk = futureSlots.slice(i, i + 3);
          const labelList = chunk.map(s => s.time.split('-')[0]).join(' / ');
          carouselColumns.push({
            title: formatJapaneseDate(chunk[0].date),
            text: `時間帯：${labelList}`,
            actions: chunk.map(s => ({
              type: 'message',
              label: s.time.split('-')[0],
              text: `${s.date} ${s.time.split('-')[0]}を予約したい`
            }))
          });
        }

        // ✅ 最大10カラムまで制限
        const replyMessage = {
          replyToken: event.replyToken,
          messages: [
            {
              type: 'template',
              altText: 'ご希望の日時を選択してください',
              template: {
                type: 'carousel',
                columns: carouselColumns.slice(0, 10)
              }
            }
          ]
        };

        axios.post('https://api.line.me/v2/bot/message/reply', replyMessage, {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer 85xLK5WKC4Dfl64wKRhWVlzwnjCycLbLpIhLuOreNOIjN3w5zhpe6bCmpzO3U15y55gFZqmJSyIUv81QaI6Remtq99Bda5ByxH7PZhz3aJsEZi75vBWNCviLzYtA4fuieXhSQEGiBhqAx8l1QgfNxQdB04t89/1O/w1cDnyilFU=`
          }
        })
        .then(response => {
          console.log('カルーセル送信成功:', response.data);
        })
        .catch(error => {
          console.error('カルーセル送信失敗:', error.response ? error.response.data : error.message);
        });
      }
    }
  }

  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`サーバー起動中 http://localhost:${PORT}`);
});
