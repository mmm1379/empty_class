import Papa from 'papaparse';

export interface Session {
  day: string;
  start: string;
  end: string;
  startMin: number;
  endMin: number;
}

export interface ClassInfo {
  name: string;
  courseNumber: string;
  group: string;
  instructor: string;
  locations: string[];
  sessions: Session[];
}

export const getBuildingName = (location: string) => {
  const parts = location.split('-');
  if (parts.length > 1) {
    return parts[0].trim();
  }
  return location.trim();
};

export const getRoomName = (location: string) => {
  const parts = location.split('-');
  if (parts.length > 1) {
    return parts.slice(1).join('-').trim();
  }
  return location.trim();
};

export const parseCSV = (csvText: string): ClassInfo[] => {
  const { data } = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  
  const classes: ClassInfo[] = [];
  
  for (const row of data as any[]) {
    const name = row['نام درس'];
    const courseNumber = row['شماره درس'];
    const group = row['گروه'];
    const instructor = [row['نام استاد1'], row['نام استاد2'], row['نام استاد3']].filter(Boolean).join(', ');
    const locationStr = row['محل تشکیل'] || '';
    const scheduleStr = row['برنامه هفتگی'] || '';
    
    const allLocations: string[] = [];
    locationStr.split(';').forEach((part: string) => {
      let cleaned = part.trim();
      const urlMatch = cleaned.match(/ و https?:\/\/| و vc\.| و cw\./);
      if (urlMatch && urlMatch.index !== undefined) {
        cleaned = cleaned.substring(0, urlMatch.index).trim();
      } else {
        if (cleaned.startsWith('http') || cleaned.startsWith('vc.') || cleaned.startsWith('cw.')) {
          cleaned = '';
        }
      }
      if (cleaned) {
        allLocations.push(cleaned);
      }
    });
    
    const locations: string[] = Array.from(new Set<string>(allLocations));
    
    const regex = /(شنبه|یکشنبه|دوشنبه|سه\s*شنبه|چهارشنبه|پنجشنبه|جمعه)\s+از\s+ساعت\s+([\d:]+)\s+تا\s+([\d:]+)/g;

    const sessions: Session[] = [];
    let match;
    while ((match = regex.exec(scheduleStr)) !== null) {
      const day = match[1].replace(/\s+/g, ' ').replace('سه‌شنبه', 'سه شنبه');
      const start = match[2];
      const end = match[3];
      
      const timeToMinutes = (t: string) => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + (m || 0);
      };
      
      sessions.push({
        day,
        start,
        end,
        startMin: timeToMinutes(start),
        endMin: timeToMinutes(end)
      });
    }
    
    if (locations.length > 0 && sessions.length > 0) {
      classes.push({
        name,
        courseNumber,
        group,
        instructor,
        locations,
        sessions
      });
    }
  }
  
  return classes;
};

export const defaultCSV = `نام درس,شماره درس,گروه,واحد,نام استاد1,نام استاد2,نام استاد3,محل تشکیل,برنامه هفتگی,تاریخ امتحان,ملاحظات,اخطار
اصول طراحی لرزه,20003,1,3,شروین ملکی,,,دانشکده مهندسی عمران-203 عمران;دانشکده مهندسی عمران-203 عمران,یکشنبه از ساعت 10:30 تا 12وسه شنبه از ساعت 10:30 تا 12,1405/04/16 14:30, ,
آمار و احتمال مهندسی,20005,1,3,هاتف عبدوس,,,دانشکده مهندسی عمران-304 عمران;دانشکده مهندسی عمران-304 عمران,شنبه از ساعت 13:30 تا 15ودوشنبه از ساعت 13:30 تا 15,1405/04/15 14:30,ظرفیت خالی برای دانشجویان سایر دانشکده هاست لطفا دانشجویان عمران ثبت نام نکنند,ظرفیت خالی برای دانشجویان سایر دانشکده هاست لطفا دانشجویان عمران ثبت نام نکنند
محاسبات عددی,20006,1,3,حامد خرازی,,,دانشکده مهندسی عمران-209 عمران;دانشکده مهندسی عمران-209 عمران,یکشنبه از ساعت 7:30 تا 9وسه شنبه از ساعت 7:30 تا 9,1405/04/06 14:30, ,
المان محدود مقدماتی,20007,1,3,امیررضا خوئی,,,دانشکده مهندسی عمران-310 عمران;دانشکده مهندسی عمران-310 عمران,شنبه از ساعت 10:30 تا 12ودوشنبه از ساعت 10:30 تا 12,1405/04/15 14:30, ,
ریسک و تاب,20008,1,3,مجتبی محصولی,,,دانشکده مهندسی عمران-111 عمران;دانشکده مهندسی عمران-111 عمران,شنبه از ساعت 10:30 تا 12ودوشنبه از ساعت 10:30 تا 12,1405/04/15 14:30, ,
استاتیک,20011,1,3,فیاض رحیم زاده روفوئی,,,دانشکده مهندسی عمران-304 عمران;دانشکده مهندسی عمران-304 عمران,یکشنبه از ساعت 9 تا 10:30وسه شنبه از ساعت 9 تا 10:30,1405/04/08 08:00, ,
دینامیک,20012,1,3,علی بخشی,,,دانشکده مهندسی عمران-209 عمران;دانشکده مهندسی عمران-209 عمران,یکشنبه از ساعت 10:30 تا 12وسه شنبه از ساعت 10:30 تا 12,1405/04/17 08:00, ,
طراحی سازه,20017,1,2,علیرضا خالو,,,دانشکده مهندسی عمران-203 عمران,شنبه از ساعت 10:30 تا 12:30,1405/04/15 14:30, ,`;
