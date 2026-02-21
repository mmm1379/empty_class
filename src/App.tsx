import React, { useState, useEffect, useMemo } from 'react';
import { parseCSV, ClassInfo, defaultCSV, getBuildingName, getRoomName } from './utils/parser';
import { Clock, Calendar, Upload, Search, MapPin, BookOpen, User, CheckCircle2, XCircle, AlertCircle, Star, StarOff, Flag } from 'lucide-react';

const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

interface Report {
  room: string;
  day: string;
  timeMin: number;
}

const toPersianDigits = (str: string) => {
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  return str.replace(/\d/g, x => persianDigits[parseInt(x)]);
};

const formatDuration = (mins: number) => {
  if (mins === Infinity) return 'تا پایان روز';
  const h = mins / 60;
  const formatted = Number.isInteger(h) ? h.toString() : h.toFixed(1).replace('.0', '');
  return toPersianDigits(`${formatted} ساعت`);
};

function App() {
  const [csvData, setCsvData] = useState<string>('');
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [selectedDay, setSelectedDay] = useState<string>('شنبه');
  const [selectedTime, setSelectedTime] = useState<string>('09:00');
  const [activeTab, setActiveTab] = useState<'search' | 'upload' | 'preferences'>('search');
  const [preferredBuildings, setPreferredBuildings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [reports, setReports] = useState<Report[]>([]);
  const [prefSearch, setPrefSearch] = useState('');

  const fetchReports = () => {
    fetch('/api/reports')
      .then(res => res.json())
      .then(data => setReports(data.reports || []))
      .catch(console.error);
  };

  useEffect(() => {
    // First try to load from localStorage for offline support
    const savedCSV = localStorage.getItem('csvData');
    if (savedCSV) {
      setCsvData(savedCSV);
      setIsLoading(false);
    } else {
      // If not in localStorage, try to fetch from server
      fetch('/api/csv')
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setCsvData(data.data);
            // Save to localStorage for offline use
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
    // Always save to localStorage for offline support
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
  }, [classes, selectedDay, selectedTime, reports]);

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
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'search' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              جستجو
            </button>
            <button 
              onClick={() => setActiveTab('preferences')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'preferences' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              مکان‌های منتخب
            </button>
            <button 
              onClick={() => setActiveTab('upload')}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${activeTab === 'upload' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              بارگذاری داده‌ها
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

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <section className="bg-white rounded-2xl shadow-sm border border-emerald-100 overflow-hidden flex flex-col">
                <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center justify-between">
                  <h2 className="font-semibold text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5" />
                    کلاس‌های خالی
                  </h2>
                </div>
                <div className="p-4 overflow-y-auto max-h-[600px] space-y-6">
                  {sortedBuildings.map(building => {
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
                              <button 
                                onClick={() => handleReport(room)}
                                className="text-xs text-slate-400 hover:text-rose-500 flex items-center gap-1 transition-colors self-end"
                                title="گزارش پر بودن کلاس"
                              >
                                <Flag className="w-3 h-3" />
                                گزارش
                              </button>
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
                  {sortedBuildings.map(building => {
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

