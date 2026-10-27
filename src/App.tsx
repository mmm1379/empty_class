import React, { useState, useEffect, useMemo } from 'react';
import { parseCSV, ClassInfo, Session, defaultCSV, getBuildingName, getRoomName } from './utils/parser';
import { Clock, Calendar, Upload, Search, MapPin, BookOpen, User, CheckCircle2, XCircle, AlertCircle, Star, StarOff, Flag, GraduationCap, Filter, X, Check, ArrowRight } from 'lucide-react';

const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

interface Report {
  room: string;
  day: string;
  timeMin: number;
}

const toPersianDigits = (str: string | number) => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.toString().replace(/\d/g, x => persianDigits[parseInt(x)]);
};

const formatDuration = (mins: number) => {
  if (mins === Infinity) return 'تا پایان روز';
  const h = mins / 60;
  const formatted = Number.isInteger(h) ? h.toString() : h.toFixed(1).replace('.0', '');
  return toPersianDigits(`${formatted} ساعت`);
};

function App() {
  const getInitialNow = () => {
    const now = new Date();
    const days = ['یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
    return {
      day: days[now.getDay()],
      time: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
    };
  };
  const initialNow = getInitialNow();

  const [csvData, setCsvData] = useState<string>('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>(initialNow.day);
  const [selectedTime, setSelectedTime] = useState<string>(initialNow.time);
  const [activeTab, setActiveTab] = useState<'search' | 'professors' | 'preferences' | 'upload'>('search');
  const [preferredBuildings, setPreferredBuildings] = useState<string[]>([]);
  const [favoriteRooms, setFavoriteRooms] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [prefSearch, setPrefSearch] = useState('');
  const [placeFilter, setPlaceFilter] = useState('');
  
  // Professor tab states
  const [profSearch, setProfSearch] = useState('');
  const [onlyAvailableFilter, setOnlyAvailableFilter] = useState(false);
  const [selectedProfessor, setSelectedProfessor] = useState<string | null>(null);
  const [profDetailDay, setProfDetailDay] = useState<string>('شنبه');
  const [isResettingCache, setIsResettingCache] = useState(false);

  const fetchReports = () => {
    fetch('/api/reports')
      .then(res => res.json())
      .then(data => setReports(data.reports || []))
      .catch(console.error);
  };

  useEffect(() => {
    const savedCSV = localStorage.getItem('csvData');
    if (savedCSV) {
      setCsvData(savedCSV);
      setIsLoading(false);
    } else {
      fetch('/api/csv')
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setCsvData(data.data);
            localStorage.setItem('csvData', data.data);
          } else {
            setCsvData(defaultCSV);
            localStorage.setItem('csvData', defaultCSV);
          }
        })
        .catch(err => {
          console.error('Failed to fetch CSV:', err);
          setCsvData(defaultCSV);
          localStorage.setItem('csvData', defaultCSV);
        })
        .finally(() => {
          setIsLoading(false);
        });
    }

    const savedPrefs = localStorage.getItem('preferredBuildings');
    if (savedPrefs) {
      try {
        setPreferredBuildings(JSON.parse(savedPrefs));
      } catch (e) {
        console.error(e);
      }
    }

    const savedFavs = localStorage.getItem('favoriteRooms');
    if (savedFavs) {
      try {
        setFavoriteRooms(JSON.parse(savedFavs));
      } catch (e) {
        console.error(e);
      }
    }

    fetchReports();
    const interval = setInterval(fetchReports, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (csvData) {
      setClasses(parseCSV(csvData));
    }
  }, [csvData]);

  const saveCsvToServer = async (data: string) => {
    localStorage.setItem('csvData', data);
    try {
      await fetch('/api/csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data }),
      });
    } catch (err) {
      console.error('Failed to save CSV:', err);
    }
  };

  const handleReport = async (room: string) => {
    const queryMin = timeToMinutes(selectedTime);
    try {
      await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, day: selectedDay, timeMin: queryMin })
      });
      fetchReports();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSetCurrentTime = () => {
    const now = new Date();
    const days = ['یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];
    setSelectedDay(days[now.getDay()]);
    setSelectedTime(`${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`);
  };

  const timeToMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };

  const togglePreference = (building: string) => {
    const newPrefs = preferredBuildings.includes(building)
      ? preferredBuildings.filter(b => b !== building)
      : [...preferredBuildings, building];
    
    setPreferredBuildings(newPrefs);
    localStorage.setItem('preferredBuildings', JSON.stringify(newPrefs));
  };

  const toggleFavoriteRoom = (room: string) => {
    const newFavs = favoriteRooms.includes(room)
      ? favoriteRooms.filter(r => r !== room)
      : [...favoriteRooms, room];
    setFavoriteRooms(newFavs);
    localStorage.setItem('favoriteRooms', JSON.stringify(newFavs));
  };

  const resetOfflineCache = async () => {
    setIsResettingCache(true);
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if (window.caches) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
      localStorage.removeItem('csvData');
      window.location.reload();
    } catch (e) {
      console.error(e);
      setIsResettingCache(false);
    }
  };

  const { allBuildings, freeRoomsByBuilding, occupiedRoomsByBuilding } = useMemo(() => {
    const allRooms = new Set<string>();
    classes.forEach(c => c.locations.forEach(l => allRooms.add(l)));

    const buildingsSet = new Set<string>();
    Array.from(allRooms).forEach(r => buildingsSet.add(getBuildingName(r)));
    const allBuildings = Array.from(buildingsSet).sort();

    const queryMin = timeToMinutes(selectedTime);
    
    const occupied = new Map<string, ClassInfo | 'REPORTED'>();
    const roomNextClassMin = new Map<string, number>();
    
    classes.forEach(c => {
      c.sessions.forEach(s => {
        if (s.day === selectedDay) {
          if (s.startMin <= queryMin && queryMin < s.endMin) {
            c.locations.forEach(l => occupied.set(l, c));
          } else if (s.startMin > queryMin) {
            c.locations.forEach(l => {
              const currentNext = roomNextClassMin.get(l) ?? Infinity;
              if (s.startMin < currentNext) {
                roomNextClassMin.set(l, s.startMin);
              }
            });
          }
        }
      });
    });

    reports.forEach(r => {
      if (r.day === selectedDay && r.timeMin <= queryMin && queryMin < r.timeMin + 90) {
        occupied.set(r.room, 'REPORTED');
      }
    });

    const free = Array.from(allRooms).filter(r => !occupied.has(r));
    
    type FreeRoomInfo = { room: string; emptyDurationMin: number };
    const freeRoomsByBuilding: Record<string, FreeRoomInfo[]> = {};
    
    free.forEach(r => {
      const b = getBuildingName(r);
      if (!freeRoomsByBuilding[b]) freeRoomsByBuilding[b] = [];
      
      const nextClassMin = roomNextClassMin.get(r) ?? Infinity;
      const emptyDurationMin = nextClassMin === Infinity ? Infinity : nextClassMin - queryMin;
      
      freeRoomsByBuilding[b].push({ room: r, emptyDurationMin });
    });

    const occupiedRoomsByBuilding: Record<string, {room: string, classInfo: ClassInfo | 'REPORTED'}[]> = {};
    Array.from(occupied.entries()).forEach(([room, classInfo]) => {
      const b = getBuildingName(room);
      if (!occupiedRoomsByBuilding[b]) occupiedRoomsByBuilding[b] = [];
      occupiedRoomsByBuilding[b].push({ room, classInfo });
    });

    Object.values(freeRoomsByBuilding).forEach(rooms => {
      rooms.sort((a, b) => {
        const aFav = favoriteRooms.includes(a.room);
        const bFav = favoriteRooms.includes(b.room);
        if (aFav !== bFav) return aFav ? -1 : 1;
        if (a.emptyDurationMin !== b.emptyDurationMin) {
          return b.emptyDurationMin - a.emptyDurationMin;
        }
        return a.room.localeCompare(b.room);
      });
    });
    
    Object.values(occupiedRoomsByBuilding).forEach(rooms => {
      rooms.sort((a, b) => a.room.localeCompare(b.room));
    });

    return { allBuildings, freeRoomsByBuilding, occupiedRoomsByBuilding };
  }, [classes, selectedDay, selectedTime, reports, favoriteRooms]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (evt) => {
        if (evt.target?.result) {
          const newData = evt.target.result as string;
          setCsvData(newData);
          saveCsvToServer(newData);
          setActiveTab('search');
        }
      };
      reader.readAsText(file);
    }
  };

  const handleTextUpload = () => {
    saveCsvToServer(csvData);
    setActiveTab('search');
  };

  const sortedBuildings = useMemo(() => {
    const preferred = allBuildings.filter(b => preferredBuildings.includes(b));
    const others = allBuildings.filter(b => !preferredBuildings.includes(b));
    return [...preferred, ...others];
  }, [allBuildings, preferredBuildings]);

  const filteredPrefBuildings = useMemo(() => {
    if (!prefSearch.trim()) return allBuildings;
    return allBuildings.filter(b => b.includes(prefSearch));
  }, [allBuildings, prefSearch]);

  const visibleBuildings = useMemo(() => {
    if (!placeFilter.trim()) return sortedBuildings;
    const q = placeFilter.trim();
    return sortedBuildings.filter(b => b.includes(q));
  }, [sortedBuildings, placeFilter]);

  const favoriteFreeRooms = useMemo(() => {
    const favSet = new Set(favoriteRooms);
    const result: { room: string; emptyDurationMin: number; building: string }[] = [];
    (Object.entries(freeRoomsByBuilding) as [string, { room: string; emptyDurationMin: number }[]][]).forEach(([building, rooms]) => {
      rooms.forEach(r => {
        if (favSet.has(r.room)) {
          result.push({ room: r.room, emptyDurationMin: r.emptyDurationMin, building });
        }
      });
    });
    return result;
  }, [freeRoomsByBuilding, favoriteRooms]);

  // Map of professor name to their ClassInfo list
  const professorClassesMap = useMemo(() => {
    const map = new Map<string, ClassInfo[]>();
    classes.forEach(c => {
      c.instructors?.forEach(p => {
        if (!p) return;
        const list = map.get(p) || [];
        list.push(c);
        map.set(p, list);
      });
    });
    return map;
  }, [classes]);

  // All unique professor names sorted alphabetically in Persian
  const allProfessors = useMemo<string[]>(() => {
    return Array.from(professorClassesMap.keys()).sort((a: string, b: string) => a.localeCompare(b, 'fa'));
  }, [professorClassesMap]);

  // Function to evaluate professor availability status for a specific day and time
  const getProfessorStatus = (prof: string, day: string, timeStr: string) => {
    const profClasses = professorClassesMap.get(prof) || [];
    const queryMin = timeToMinutes(timeStr);

    const daySessions: { classInfo: ClassInfo; session: Session }[] = [];
    profClasses.forEach(c => {
      c.sessions.forEach(s => {
        if (s.day === day) {
          daySessions.push({ classInfo: c, session: s });
        }
      });
    });

    daySessions.sort((a, b) => a.session.startMin - b.session.startMin);

    const hasClassToday = daySessions.length > 0;
    if (!hasClassToday) {
      return {
        status: 'NO_CLASS_TODAY' as const,
        daySessions,
        currentClass: null,
        nextClass: null,
        prevClass: null,
      };
    }

    const currentClass = daySessions.find(
      item => item.session.startMin <= queryMin && queryMin < item.session.endMin
    );

    if (currentClass) {
      return {
        status: 'IN_CLASS' as const,
        daySessions,
        currentClass,
        nextClass: null,
        prevClass: null,
      };
    }

    const nextClass = daySessions.find(item => item.session.startMin > queryMin) || null;
    const prevClass = [...daySessions].reverse().find(item => item.session.endMin <= queryMin) || null;

    return {
      status: 'AVAILABLE' as const,
      daySessions,
      currentClass: null,
      nextClass,
      prevClass,
    };
  };

  const getProfessorTeachingDays = (prof: string) => {
    const profClasses = professorClassesMap.get(prof) || [];
    const daysSet = new Set<string>();
    profClasses.forEach(c => c.sessions.forEach(s => daysSet.add(s.day)));
    return DAYS.filter(d => daysSet.has(d));
  };

  const getProfessorBuildings = (prof: string) => {
    const profClasses = professorClassesMap.get(prof) || [];
    const bSet = new Set<string>();
    profClasses.forEach(c => c.locations.forEach(l => bSet.add(getBuildingName(l))));
    return Array.from(bSet);
  };

  const getDailyTimeline = (daySessions: { classInfo: ClassInfo; session: Session }[]) => {
    if (daySessions.length === 0) return [];
    const sorted = [...daySessions].sort((a, b) => a.session.startMin - b.session.startMin);
    
    type TimelineItem = 
      | { type: 'class'; classInfo: ClassInfo; session: Session }
      | { type: 'free'; start: string; end: string; startMin: number; endMin: number; durationMin: number };
      
    const timeline: TimelineItem[] = [];
    
    for (let i = 0; i < sorted.length; i++) {
      const cur = sorted[i];
      if (i > 0) {
        const prev = sorted[i - 1];
        if (cur.session.startMin > prev.session.endMin) {
          const durationMin = cur.session.startMin - prev.session.endMin;
          timeline.push({
            type: 'free',
            start: prev.session.end,
            end: cur.session.start,
            startMin: prev.session.endMin,
            endMin: cur.session.startMin,
            durationMin,
          });
        }
      }
      timeline.push({
        type: 'class',
        classInfo: cur.classInfo,
        session: cur.session,
      });
    }
    
    return timeline;
  };

  const availableProfessorsCount = useMemo(() => {
    return allProfessors.filter(p => {
      const info = getProfessorStatus(p, selectedDay, selectedTime);
      return info.status === 'AVAILABLE';
    }).length;
  }, [allProfessors, selectedDay, selectedTime, professorClassesMap]);

  const filteredProfessors = useMemo(() => {
    let list = allProfessors;
    if (profSearch.trim()) {
      const q = profSearch.trim().toLowerCase();
      list = list.filter(p => p.toLowerCase().includes(q));
    }
    if (onlyAvailableFilter) {
      list = list.filter(p => {
        const info = getProfessorStatus(p, selectedDay, selectedTime);
        return info.status === 'AVAILABLE';
      });
    }
    return list;
  }, [allProfessors, profSearch, onlyAvailableFilter, selectedDay, selectedTime, professorClassesMap]);

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">در حال بارگذاری...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans" dir="rtl">
      <header className="bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 text-indigo-600">
            <MapPin className="w-6 h-6" />
            <h1 className="text-xl font-bold tracking-tight">کلاس‌یاب شریف</h1>
          </div>
          <nav className="flex gap-1 bg-slate-100 p-1 rounded-lg overflow-x-auto">
            <button 
              onClick={() => setActiveTab('search')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <MapPin className="w-4 h-4" />
              <span>جستجوی کلاس‌ها</span>
            </button>
            <button 
              onClick={() => setActiveTab('professors')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'professors' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <GraduationCap className="w-4 h-4" />
              <span>برنامه اساتید</span>
            </button>
            <button 
              onClick={() => setActiveTab('preferences')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'preferences' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Star className="w-4 h-4" />
              <span>مکان‌های منتخب</span>
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`px-3 sm:px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5 ${activeTab === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              <Upload className="w-4 h-4" />
              <span>بارگذاری داده‌ها</span>
            </button>
          </nav>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'search' ? (
          <div className="space-y-8">
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/3 space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4" />
                    روز هفته
                  </label>
                  <select 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="w-full md:w-1/3 space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    ساعت
                  </label>
                  <input 
                    type="time" 
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-left"
                  />
                </div>
                <div className="w-full md:w-1/3">
                  <button 
                    onClick={handleSetCurrentTime}
                    className="w-full h-11 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    هم‌اکنون
                  </button>
                </div>
              </div>
            </section>

            <section className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <div className="relative">
                <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="فیلتر بر اساس مکان (ساختمان/کلاس)..."
                  value={placeFilter}
                  onChange={(e) => setPlaceFilter(e.target.value)}
                  className="w-full h-11 pr-10 pl-4 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                />
              </div>
            </section>

            {favoriteFreeRooms.length > 0 && (
              <section className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                <div className="bg-amber-50 border-b border-amber-100 p-4 flex items-center justify-between">
                  <h2 className="font-semibold text-amber-800 flex items-center gap-2">
                    <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                    کلاس‌های محبوب (پیشنهادی)
                  </h2>
                </div>
                <div className="p-4">
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {favoriteFreeRooms.map(({ room, emptyDurationMin, building }) => (
                      <li key={room} className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                            <MapPin className="w-4 h-4 text-amber-500 shrink-0" />
                            <span className="truncate" title={room}>{getRoomName(room)}</span>
                          </div>
                          <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                            {formatDuration(emptyDurationMin)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs text-slate-500">
                          <span>{building}</span>
                          <button
                            onClick={() => toggleFavoriteRoom(room)}
                            className="text-amber-500 hover:text-amber-600 flex items-center gap-1"
                            title="حذف از محبوب‌ها"
                          >
                            <Star className="w-3.5 h-3.5 fill-amber-400" />
                            محبوب
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden flex flex-col">
                <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center justify-between">
                  <h2 className="font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    کلاس‌های خالی
                  </h2>
                </div>
                <div className="p-4 overflow-y-auto max-h-[600px] space-y-6">
                  {visibleBuildings.map(building => {
                    const rooms = freeRoomsByBuilding[building];
                    if (!rooms || rooms.length === 0) return null;
                    
                    const isPreferred = preferredBuildings.includes(building);
                    
                    return (
                      <div key={building} className="space-y-3">
                        <h3 className="font-medium text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                          {isPreferred && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                          {building}
                          <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">{rooms.length}</span>
                        </h3>
                        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {rooms.map(({ room, emptyDurationMin }) => (
                            <li key={room} className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex flex-col gap-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                  <MapPin className="w-4 h-4 text-emerald-500 shrink-0" />
                                  <span className="truncate" title={room}>{getRoomName(room)}</span>
                                </div>
                                <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                  {formatDuration(emptyDurationMin)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => toggleFavoriteRoom(room)}
                                  className={`text-xs flex items-center gap-1 transition-colors ${favoriteRooms.includes(room) ? 'text-amber-500' : 'text-slate-400 hover:text-amber-500'}`}
                                  title="افزودن به محبوب‌ها"
                                >
                                  <Star className={`w-3.5 h-3.5 ${favoriteRooms.includes(room) ? 'fill-amber-400' : ''}`} />
                                  {favoriteRooms.includes(room) ? 'محبوب' : 'محبوب کردن'}
                                </button>
                                <button 
                                  onClick={() => handleReport(room)}
                                  className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors"
                                  title="گزارش پر بودن کلاس"
                                >
                                  <Flag className="w-3 h-3" />
                                  گزارش
                                </button>
                              </div>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                  {Object.keys(freeRoomsByBuilding).length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>هیچ کلاس خالی یافت نشد.</p>
                    </div>
                  )}
                </div>
              </section>

              <section className="bg-white rounded-2xl shadow-sm border border-rose-100 overflow-hidden flex flex-col">
                <div className="bg-rose-50 border-b border-rose-100 p-4 flex items-center justify-between">
                  <h2 className="font-semibold text-rose-800 flex items-center gap-2">
                    <XCircle className="w-5 h-5" />
                    کلاس‌های در حال برگزاری
                  </h2>
                </div>
                <div className="p-4 overflow-y-auto max-h-[600px] space-y-6">
                  {visibleBuildings.map(building => {
                    const rooms = occupiedRoomsByBuilding[building];
                    if (!rooms || rooms.length === 0) return null;
                    
                    const isPreferred = preferredBuildings.includes(building);
                    
                    return (
                      <div key={building} className="space-y-3">
                        <h3 className="font-medium text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                          {isPreferred && <Star className="w-4 h-4 text-amber-400 fill-amber-400" />}
                          {building}
                          <span className="text-xs bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full">{rooms.length}</span>
                        </h3>
                        <div className="space-y-3">
                          {rooms.map(({ room, classInfo }) => (
                            <div key={room} className="p-4 rounded-xl bg-slate-50 border border-slate-100 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="font-medium text-slate-900 flex items-center gap-2">
                                  <MapPin className="w-4 h-4 text-rose-500 shrink-0" />
                                  {getRoomName(room)}
                                </h4>
                                {classInfo !== 'REPORTED' && (
                                  <span className="text-xs font-mono bg-slate-200 text-slate-700 px-2 py-1 rounded-md shrink-0">
                                    {classInfo.courseNumber}-{classInfo.group}
                                  </span>
                                )}
                              </div>
                              {classInfo === 'REPORTED' ? (
                                <div className="flex items-center gap-1.5 text-sm text-rose-600 font-medium">
                                  <Flag className="w-4 h-4" />
                                  <span>گزارش شده توسط کاربران</span>
                                </div>
                              ) : (
                                <div className="flex items-center gap-4 text-sm text-slate-600">
                                  <div className="flex items-center gap-1.5">
                                    <BookOpen className="w-4 h-4 text-slate-400" />
                                    <span className="truncate max-w-[150px]" title={classInfo.name}>{classInfo.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <User className="w-4 h-4 text-slate-400" />
                                    <span className="truncate max-w-[120px]" title={classInfo.instructor}>{classInfo.instructor || 'نامشخص'}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                  {Object.keys(occupiedRoomsByBuilding).length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <AlertCircle className="w-12 h-12 mx-auto mb-3 text-slate-300" />
                      <p>هیچ کلاسی در این زمان برگزار نمی‌شود.</p>
                    </div>
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : activeTab === 'professors' ? (
          <div className="space-y-6">
            {/* Day and Time Controller */}
            <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row gap-4 items-end">
                <div className="w-full md:w-1/3 space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    روز هفته
                  </label>
                  <select 
                    value={selectedDay}
                    onChange={(e) => setSelectedDay(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  >
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="w-full md:w-1/3 space-y-2">
                  <label className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    ساعت
                  </label>
                  <input 
                    type="time" 
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full h-11 px-3 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all font-mono text-left"
                  />
                </div>
                <div className="w-full md:w-1/3">
                  <button 
                    onClick={handleSetCurrentTime}
                    className="w-full h-11 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
                  >
                    <Clock className="w-4 h-4" />
                    هم‌اکنون
                  </button>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-2 text-xs text-slate-600">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>معیار در دسترس بودن:</strong> استاد زمانی در دسترس است که در آن روز کلاس داشته باشد (در دانشگاه حضور داشته باشد)، اما در ساعت انتخابی ({toPersianDigits(selectedTime)}) کلاسی نداشته باشد.
                </span>
              </div>
            </section>

            {/* Search and Quick Filters */}
            <section className="bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:flex-1">
                  <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="جستجوی نام یا نام‌خانوادگی استاد... (مثال: شروین ملکی، حمید ضرابی زاده، هاتف عبدوس)"
                    value={profSearch}
                    onChange={(e) => setProfSearch(e.target.value)}
                    className="w-full h-11 pr-10 pl-10 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-sm"
                  />
                  {profSearch && (
                    <button 
                      onClick={() => setProfSearch('')}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setOnlyAvailableFilter(!onlyAvailableFilter)}
                  className={`w-full sm:w-auto h-11 px-4 rounded-xl border flex items-center justify-center gap-2 text-sm font-medium transition-all ${
                    onlyAvailableFilter
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  <Filter className="w-4 h-4" />
                  <span>فقط اساتید در دسترس در این ساعت</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                    onlyAvailableFilter ? 'bg-emerald-700 text-white' : 'bg-emerald-200/70 text-emerald-900'
                  }`}>
                    {toPersianDigits(availableProfessorsCount)}
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                <span>نمایش {toPersianDigits(filteredProfessors.length)} استاد از {toPersianDigits(allProfessors.length)} استاد</span>
                {onlyAvailableFilter && (
                  <span className="text-emerald-700 font-medium">فیلتر اساتید آزاد در {selectedDay} ساعت {toPersianDigits(selectedTime)} فعال است</span>
                )}
              </div>
            </section>

            {/* Professors Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProfessors.slice(0, 60).map(prof => {
                const statusInfo = getProfessorStatus(prof, selectedDay, selectedTime);
                const teachingDays = getProfessorTeachingDays(prof);
                const buildings = getProfessorBuildings(prof);
                const profClasses = professorClassesMap.get(prof) || [];

                return (
                  <div 
                    key={prof}
                    onClick={() => {
                      setSelectedProfessor(prof);
                      setProfDetailDay(selectedDay);
                    }}
                    className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer flex flex-col justify-between gap-4 text-right"
                  >
                    <div>
                      {/* Top Header */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                            <GraduationCap className="w-5 h-5" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900 text-base">{prof}</h3>
                            <span className="text-xs text-slate-500">{toPersianDigits(profClasses.length)} درس ارائه شده</span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        {statusInfo.status === 'AVAILABLE' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            در دسترس
                          </span>
                        )}
                        {statusInfo.status === 'IN_CLASS' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-rose-100 text-rose-800 border border-rose-200 shrink-0">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            در کلاس
                          </span>
                        )}
                        {statusInfo.status === 'NO_CLASS_TODAY' && (
                          <span className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-slate-100 text-slate-600 border border-slate-200 shrink-0">
                            بدون کلاس امروز
                          </span>
                        )}
                      </div>

                      {/* Status Explanation */}
                      <div className="text-xs p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1 mb-3">
                        {statusInfo.status === 'AVAILABLE' && (
                          <div>
                            <p className="text-emerald-700 font-medium">امروز در دانشگاه است و در این ساعت کلاسی ندارد.</p>
                            {statusInfo.nextClass ? (
                              <p className="text-slate-600">
                                کلاس بعدی: <span className="font-medium text-slate-800">{statusInfo.nextClass.classInfo.name}</span> (ساعت {toPersianDigits(statusInfo.nextClass.session.start)})
                              </p>
                            ) : statusInfo.prevClass ? (
                              <p className="text-slate-600">کلاس‌های امروز پایان یافته است.</p>
                            ) : null}
                          </div>
                        )}
                        {statusInfo.status === 'IN_CLASS' && statusInfo.currentClass && (
                          <div>
                            <p className="text-rose-700 font-medium">
                              در حال تدریس: {statusInfo.currentClass.classInfo.name}
                            </p>
                            <p className="text-slate-600">
                              تا ساعت {toPersianDigits(statusInfo.currentClass.session.end)}
                              {statusInfo.currentClass.classInfo.locations[0] && ` در ${getRoomName(statusInfo.currentClass.classInfo.locations[0])}`}
                            </p>
                          </div>
                        )}
                        {statusInfo.status === 'NO_CLASS_TODAY' && (
                          <p className="text-slate-500">
                            در روز {selectedDay} کلاسی ندارد. روزهای حضور: {teachingDays.join('، ') || 'نامشخص'}
                          </p>
                        )}
                      </div>

                      {/* Location / Department tags */}
                      {buildings.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-1">
                          {buildings.slice(0, 2).map(b => (
                            <span key={b} className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md truncate max-w-[180px]">
                              {b}
                            </span>
                          ))}
                          {buildings.length > 2 && (
                            <span className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md">
                              +{toPersianDigits(buildings.length - 2)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-indigo-600 font-medium group">
                      <span>مشاهده زمان‌های آزاد و برنامه هفتگی</span>
                      <ArrowRight className="w-3.5 h-3.5 rotate-180 group-hover:-translate-x-1 transition-transform" />
                    </div>
                  </div>
                );
              })}

              {filteredProfessors.length === 0 && (
                <div className="col-span-full bg-white p-12 rounded-2xl border border-slate-200 text-center space-y-3">
                  <AlertCircle className="w-12 h-12 text-slate-300 mx-auto" />
                  <h3 className="font-bold text-slate-700 text-lg">استادی با این مشخصات یافت نشد</h3>
                  <p className="text-slate-500 text-sm">
                    {onlyAvailableFilter
                      ? `هیچ استادی در روز ${selectedDay} ساعت ${toPersianDigits(selectedTime)} با شرایط در دسترس بودن یافت نشد.`
                      : 'عبارت جستجو را تغییر دهید یا فیلترها را بررسی کنید.'}
                  </p>
                  {onlyAvailableFilter && (
                    <button
                      onClick={() => setOnlyAvailableFilter(false)}
                      className="mt-2 px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-medium transition-colors"
                    >
                      نمایش تمام اساتید
                    </button>
                  )}
                </div>
              )}
            </div>

            {filteredProfessors.length > 60 && (
              <p className="text-center text-xs text-slate-500 pt-2">
                برای مشاهده سایر اساتید، از کادر جستجو نام استاد را وارد نمایید.
              </p>
            )}

            {/* Professor Detailed Modal */}
            {selectedProfessor && (
              <div 
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto"
                onClick={() => setSelectedProfessor(null)}
              >
                <div 
                  className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200 text-right"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Modal Header */}
                  <div className="p-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                        <GraduationCap className="w-6 h-6" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-slate-900">{selectedProfessor}</h2>
                        <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                          <span>{getProfessorBuildings(selectedProfessor).join('، ') || 'دانشگاه صنعتی شریف'}</span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedProfessor(null)}
                      className="text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 p-2 rounded-xl transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto space-y-6">
                    {/* Status at Query Time */}
                    {(() => {
                      const statusInfo = getProfessorStatus(selectedProfessor, selectedDay, selectedTime);
                      return (
                        <div className={`p-4 rounded-2xl border flex items-start gap-3 ${
                          statusInfo.status === 'AVAILABLE' 
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-900' 
                            : statusInfo.status === 'IN_CLASS' 
                            ? 'bg-rose-50 border-rose-200 text-rose-900' 
                            : 'bg-slate-100 border-slate-200 text-slate-800'
                        }`}>
                          <div className="mt-0.5">
                            {statusInfo.status === 'AVAILABLE' && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                            {statusInfo.status === 'IN_CLASS' && <XCircle className="w-5 h-5 text-rose-600" />}
                            {statusInfo.status === 'NO_CLASS_TODAY' && <AlertCircle className="w-5 h-5 text-slate-500" />}
                          </div>
                          <div className="space-y-1">
                            <h4 className="font-bold text-sm">
                              {statusInfo.status === 'AVAILABLE' && `در دسترس در روز ${selectedDay} ساعت ${toPersianDigits(selectedTime)}`}
                              {statusInfo.status === 'IN_CLASS' && `در حال تدریس در روز ${selectedDay} ساعت ${toPersianDigits(selectedTime)}`}
                              {statusInfo.status === 'NO_CLASS_TODAY' && `در روز ${selectedDay} کلاسی ندارد`}
                            </h4>
                            <p className="text-xs leading-relaxed opacity-90">
                              {statusInfo.status === 'AVAILABLE' && 'این استاد امروز در دانشگاه برنامه کلاسی دارد و در این ساعت کلاسی ندارد، بنابراین فرصت مناسبی برای مراجعه حضوری است.'}
                              {statusInfo.status === 'IN_CLASS' && statusInfo.currentClass && (
                                <>
                                  مشغول تدریس درس <strong>{statusInfo.currentClass.classInfo.name}</strong> (ساعت {toPersianDigits(statusInfo.currentClass.session.start)} تا {toPersianDigits(statusInfo.currentClass.session.end)}) در <strong>{statusInfo.currentClass.classInfo.locations.join(' و ')}</strong>
                                </>
                              )}
                              {statusInfo.status === 'NO_CLASS_TODAY' && 'این استاد در روز انتخاب‌شده برنامه‌ای در سامانه ندارد و احتمالاً در دانشگاه حضور ندارد.'}
                            </p>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Day Schedule Inspector */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-indigo-600" />
                          برنامه روزانه و زمان‌های آزاد
                        </h4>
                        <span className="text-xs text-slate-400">یک روز را انتخاب کنید</span>
                      </div>

                      {/* Day Tabs */}
                      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto">
                        {DAYS.map(day => {
                          const profClasses = professorClassesMap.get(selectedProfessor) || [];
                          const hasClassOnDay = profClasses.some(c => c.sessions.some(s => s.day === day));
                          return (
                            <button
                              key={day}
                              onClick={() => setProfDetailDay(day)}
                              className={`flex-1 min-w-[70px] py-1.5 px-2 rounded-lg text-xs font-medium transition-all ${
                                profDetailDay === day 
                                  ? 'bg-white text-indigo-700 shadow-sm font-bold' 
                                  : hasClassOnDay 
                                  ? 'text-slate-700 hover:text-slate-900 hover:bg-slate-200/50' 
                                  : 'text-slate-400 hover:text-slate-600'
                              }`}
                            >
                              <span>{day}</span>
                              {hasClassOnDay && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block mr-1"></span>}
                            </button>
                          );
                        })}
                      </div>

                      {/* Timeline for Selected Detail Day */}
                      {(() => {
                        const profClasses = professorClassesMap.get(selectedProfessor) || [];
                        const daySessions: { classInfo: ClassInfo; session: Session }[] = [];
                        profClasses.forEach(c => {
                          c.sessions.forEach(s => {
                            if (s.day === profDetailDay) {
                              daySessions.push({ classInfo: c, session: s });
                            }
                          });
                        });

                        const timeline = getDailyTimeline(daySessions);

                        if (timeline.length === 0) {
                          return (
                            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500 text-sm">
                              در روز {profDetailDay} کلاسی برای این استاد ثبت نشده است.
                            </div>
                          );
                        }

                        return (
                          <div className="space-y-2">
                            {timeline.map((item, idx) => {
                              if (item.type === 'free') {
                                return (
                                  <div 
                                    key={`free-${idx}`}
                                    className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between text-xs text-emerald-900"
                                  >
                                    <div className="flex items-center gap-2">
                                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                      <div>
                                        <span className="font-bold text-emerald-800">بازه آزاد و در دسترس استاد</span>
                                        <span className="text-emerald-700 mr-2">
                                          (از {toPersianDigits(item.start)} تا {toPersianDigits(item.end)})
                                        </span>
                                      </div>
                                    </div>
                                    <span className="font-medium bg-emerald-200/60 text-emerald-900 px-2 py-0.5 rounded-md">
                                      {formatDuration(item.durationMin)}
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div 
                                  key={`class-${idx}`}
                                  className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                                >
                                  <div className="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4 text-indigo-600 shrink-0" />
                                    <div>
                                      <span className="font-bold text-slate-800 text-sm">{item.classInfo.name}</span>
                                      <span className="text-slate-500 mr-2">گروه {toPersianDigits(item.classInfo.group)}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3 text-slate-600">
                                    <div className="flex items-center gap-1 font-mono">
                                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                                      <span>{toPersianDigits(item.session.start)} تا {toPersianDigits(item.session.end)}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                                      <span className="truncate max-w-[150px]">{item.classInfo.locations[0] ? getRoomName(item.classInfo.locations[0]) : 'نامشخص'}</span>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* All Courses Taught */}
                    <div className="space-y-3 pt-2">
                      <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        دروس ارائه شده توسط استاد در این نیم‌سال
                      </h4>
                      <div className="space-y-2">
                        {(professorClassesMap.get(selectedProfessor) || []).map((c, i) => (
                          <div key={i} className="p-3 rounded-xl border border-slate-200 bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div>
                              <span className="font-bold text-slate-900 text-sm">{c.name}</span>
                              <span className="text-slate-500 mr-2">(کد درس: {toPersianDigits(c.courseNumber)} - گروه {toPersianDigits(c.group)})</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-slate-600">
                              {c.sessions.map((s, si) => (
                                <span key={si} className="bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                  {s.day} {toPersianDigits(s.start)}-{toPersianDigits(s.end)}
                                </span>
                              ))}
                              {c.locations.length > 0 && (
                                <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[11px]">
                                  {getRoomName(c.locations[0])}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Modal Footer */}
                  <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
                    <button
                      onClick={() => setSelectedProfessor(null)}
                      className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-medium rounded-xl text-sm transition-colors"
                    >
                      بستن
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'preferences' ? (
          <div className="max-w-2xl mx-auto">
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-6">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">مکان‌های منتخب</h2>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  مکان‌هایی که بیشتر در آن‌ها تردد دارید را انتخاب کنید تا در نتایج جستجو بالاتر نمایش داده شوند.
                </p>
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input 
                    type="text" 
                    placeholder="جستجوی مکان..."
                    value={prefSearch}
                    onChange={(e) => setPrefSearch(e.target.value)}
                    className="w-full h-11 pr-10 pl-4 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-2">
                {filteredPrefBuildings.map(building => {
                  const isPreferred = preferredBuildings.includes(building);
                  return (
                    <button
                      key={building}
                      onClick={() => togglePreference(building)}
                      className={`flex items-center justify-between p-4 rounded-xl border text-right transition-all ${
                        isPreferred 
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-900' 
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200 hover:bg-slate-50'
                      }`}
                    >
                      <span className="font-medium truncate ml-2">{building}</span>
                      {isPreferred ? (
                        <Star className="w-5 h-5 text-amber-400 fill-amber-400 shrink-0" />
                      ) : (
                        <StarOff className="w-5 h-5 text-slate-300 shrink-0" />
                      )}
                    </button>
                  );
                })}
                {filteredPrefBuildings.length === 0 && (
                  <div className="col-span-full text-center py-8 text-slate-500">
                    مکانی یافت نشد.
                  </div>
                )}
              </div>
            </section>

            <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">تنظیمات آفلاین</h2>
                <p className="text-slate-600 text-sm leading-relaxed mb-4">
                  در صورت نصب PWA، برنامه به صورت آفلاین کار می‌کند. برای دریافت نسخه جدید از وب، کش را بازنشانی کنید.
                </p>
                <button
                  onClick={resetOfflineCache}
                  disabled={isResettingCache}
                  className="w-full h-11 bg-rose-50 text-rose-700 hover:bg-rose-100 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {isResettingCache ? 'در حال بازنشانی...' : 'بازنشانی کش آفلاین'}
                </button>
              </div>
            </section>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto">
            <section className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 text-center space-y-6">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
                <Upload className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-2">بارگذاری فایل برنامه‌ها</h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  فایل CSV حاوی برنامه کلاس‌ها را بارگذاری کنید. این فایل در سرور ذخیره می‌شود.
                </p>
              </div>
              
              <div className="relative">
                <input 
                  type="file" 
                  accept=".csv" 
                  onChange={handleFileUpload}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 hover:bg-slate-50 hover:border-indigo-400 transition-colors">
                  <span className="text-indigo-600 font-medium">انتخاب فایل CSV</span>
                  <span className="text-slate-500 text-sm block mt-1">یا کشیدن و رها کردن فایل اینجا</span>
                </div>
              </div>

              <div className="pt-6 border-t border-slate-100">
                <p className="text-sm text-slate-500 mb-3 text-right">یا متن CSV را مستقیماً اینجا قرار دهید:</p>
                <textarea 
                  className="w-full h-48 p-4 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all text-left font-mono text-xs"
                  dir="ltr"
                  placeholder="Paste CSV content here..."
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                />
                <button 
                  onClick={handleTextUpload}
                  className="mt-4 w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-xl transition-colors"
                >
                  ذخیره و جستجو
                </button>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;

