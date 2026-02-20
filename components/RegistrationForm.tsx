
import React, { useState, useRef, useEffect } from 'react';
import { PatientProfile } from '../types';
import { User, Calendar, Users, ChevronLeft, ChevronRight } from 'lucide-react';

interface RegistrationFormProps {
  onComplete: (profile: PatientProfile) => void;
}

const CalendarPicker: React.FC<{ value: string; onChange: (val: string) => void }> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [viewDate, setViewDate] = useState(value ? new Date(value) : new Date());
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync viewDate when value changes externally or picker opens
  useEffect(() => {
    if (value && isOpen) {
      setViewDate(new Date(value));
    }
  }, [value, isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const handlePrevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1));
  const handleNextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1));
  
  const handleYearChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setViewDate(new Date(parseInt(e.target.value), viewDate.getMonth(), 1));
  };

  const handleDaySelect = (day: number) => {
    const selectedDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    const offset = selectedDate.getTimezoneOffset();
    const localDate = new Date(selectedDate.getTime() - (offset * 60 * 1000));
    onChange(localDate.toISOString().split('T')[0]);
    setIsOpen(false);
  };

  const years = Array.from({ length: 100 }, (_, i) => new Date().getFullYear() - i);
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  return (
    <div className="relative" ref={containerRef}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none transition-all flex justify-between items-center cursor-pointer bg-white"
      >
        <span className={value ? 'text-slate-800 font-medium' : 'text-slate-400'}>
          {value ? new Date(value).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Select date of birth'}
        </span>
        <Calendar className="w-4 h-4 text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute z-[60] mt-2 p-4 bg-white border border-slate-200 rounded-2xl shadow-2xl w-[320px] left-1/2 -translate-x-1/2 sm:left-0 sm:translate-x-0">
          <div className="flex justify-between items-center mb-4">
            <button onClick={handlePrevMonth} type="button" className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600" />
            </button>
            
            <div className="flex gap-1">
              <select 
                value={viewDate.getMonth()} 
                onChange={(e) => setViewDate(new Date(viewDate.getFullYear(), parseInt(e.target.value), 1))}
                className="text-sm font-bold bg-transparent outline-none cursor-pointer hover:text-medical-600"
              >
                {months.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>
              <select 
                value={viewDate.getFullYear()} 
                onChange={handleYearChange}
                className="text-sm font-bold bg-transparent outline-none cursor-pointer hover:text-medical-600"
              >
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            <button onClick={handleNextMonth} type="button" className="p-1 hover:bg-slate-100 rounded-full transition-colors">
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-slate-400 uppercase">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayOfMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth(viewDate.getFullYear(), viewDate.getMonth()) }).map((_, i) => {
              const day = i + 1;
              const isSelected = value && new Date(value).getDate() === day && 
                                new Date(value).getMonth() === viewDate.getMonth() && 
                                new Date(value).getFullYear() === viewDate.getFullYear();
              
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleDaySelect(day)}
                  className={`py-2 text-sm rounded-lg transition-all ${
                    isSelected 
                      ? 'bg-medical-600 text-white font-bold scale-110 shadow-sm' 
                      : 'hover:bg-medical-50 text-slate-700'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export const RegistrationForm: React.FC<RegistrationFormProps> = ({ onComplete }) => {
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !dob) return;
    onComplete({ name, dob, gender });
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-3xl shadow-2xl border border-slate-100">
      <div className="text-center mb-8">
        <div className="bg-medical-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="text-medical-600 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight">Patient Profile</h2>
        <p className="text-slate-500 text-sm mt-1">This info personalizes your clinical summary.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <User className="w-4 h-4 text-medical-500" /> Full Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-medical-500 focus:border-medical-500 outline-none transition-all font-medium"
            placeholder="e.g. John Doe"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-medical-500" /> Date of Birth
          </label>
          <CalendarPicker value={dob} onChange={setDob} />
        </div>

        <div>
          <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4 text-medical-500" /> Gender
          </label>
          <div className="grid grid-cols-3 gap-3">
            {['Male', 'Female', 'Other'].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(g as any)}
                className={`py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  gender === g 
                    ? 'bg-medical-600 border-medical-600 text-white shadow-lg scale-[1.02]' 
                    : 'bg-white border-slate-200 text-slate-600 hover:border-medical-200'
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          className="w-full bg-medical-600 text-white py-4 rounded-2xl font-extrabold hover:bg-medical-700 transition-all shadow-xl hover:shadow-medical-200/50 transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Initialize Timeline
        </button>
      </form>
    </div>
  );
};
