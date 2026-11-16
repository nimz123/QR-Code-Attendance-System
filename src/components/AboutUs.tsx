import React from 'react';
import { Info, Users, Cpu, ShieldCheck, ArrowLeft, QrCode, Lock, CheckCircle2, School, Image as ImageIcon, Award } from 'lucide-react';

interface AboutUsProps {
  onBackToHome: () => void;
}

export default function AboutUs({ onBackToHome }: AboutUsProps) {
  // Permanent research documentation pictures (Using standard .jpg extension)
  const docImages = [
    {
      src: '/photo1.jpg',
      caption: 'System Development & Coding Session'
    },
    {
      src: '/photo2.jpg',
      caption: 'Testing & Troubleshooting the QR Portal'
    },
    {
      src: '/photo3.jpg',
      caption: 'Team Collaboration & System Verification'
    },
    {
      src: '/photo4.jpg',
      caption: 'Research Team Deployment Outdoors'
    },
    {
      src: '/photo5.jpg',
      caption: 'CTU Pinamungajan Campus Documentation'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 sm:p-10 shadow-2xl space-y-8 my-6 animate-fadeIn">
      
      {/* HEADER & BACK BUTTON */}
      <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-6">
        <div className="flex items-center gap-4">
          <div className="bg-indigo-600 p-3.5 rounded-2xl text-white shadow-lg">
            <Info size={28} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              About Edulectrical Attendance System
            </h1>
            <p className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 font-bold mt-1">
              Research Project Platform &bull; CTU PINAMUNGAJAN CAMPUS
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToHome}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition cursor-pointer shadow-xs"
        >
          <ArrowLeft size={16} />
          <span>Back to Home</span>
        </button>
      </div>

      {/* TEAM STORY / RESEARCH BACKGROUND */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <School size={20} className="text-indigo-500" />
          <span>Research Background &amp; Team Story</span>
        </h2>
        <div className="text-sm sm:text-base text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-gray-800/50 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-4">
          <p>
            We are a team of 11 dedicated and passionate members who worked together to develop a QR-Based Attendance Monitoring System. Our team was formed with a shared goal of creating a modern, convenient, and efficient solution to improve the traditional attendance-taking process.
          </p>
          <p>
            Through teamwork, cooperation, creativity, and dedication, we successfully developed a system that uses QR code technology to record and monitor attendance. Instead of manually writing names or checking attendance one by one, users can simply scan their assigned QR codes for a faster and more organized process.
          </p>
          <p>
            Throughout the development, each member contributed their knowledge, skills, and ideas to make the project possible. We faced challenges, learned new things, and worked together to improve the system's functionality and reliability for <strong>research purposes</strong>.
          </p>
          <p className="font-bold text-indigo-600 dark:text-indigo-400 pt-2 border-t border-gray-200 dark:border-gray-700">
            As a team, we believe that technology can make everyday tasks easier, more accurate, and more efficient. Our QR-Based Attendance Monitoring System represents our hard work, unity, and commitment to creating a practical technological solution that can benefit students, teachers, and the CTU PINAMUNGAJAN INSTITUTION.
          </p>
        </div>
      </div>

      {/* CORE FEATURES */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Cpu size={20} className="text-indigo-500" />
          <span>System Features &amp; Functionality</span>
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <ShieldCheck size={18} />
              <span>Facial Biometric Security Verification</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Students must complete a live facial scan during check-in to ensure authentic attendance submission and eliminate proxy sign-ins.
            </p>
          </div>

          <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <QrCode size={18} />
              <span>QR Code &amp; Manual Section Selection</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              Users can quickly scan section QR codes or use manual instructor and subject selection with verified teacher profile picture previews.
            </p>
          </div>

          <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <Lock size={18} />
              <span>Role-Based Secure Portals</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              The platform provides dedicated, password-protected portals for Administrators, Teachers, and Students to manage records safely.
            </p>
          </div>

          <div className="p-5 bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 rounded-2xl space-y-2">
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-bold text-sm">
              <CheckCircle2 size={18} />
              <span>Automated Punctuality Status</span>
            </div>
            <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
              The system automatically calculates arrival times and marks attendance records as Present, Late, or Time Out based on schedules.
            </p>
          </div>

        </div>
      </div>

      {/* TEAM MEMBERS DIRECTORY */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <Award size={20} className="text-indigo-500" />
          <span>Our 11-Member Research Team</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-md space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider opacity-80 font-bold">Team Leader</span>
            <h4 className="font-extrabold text-sm">Daniel Klint Dakay</h4>
          </div>

          <div className="p-4 bg-indigo-500 text-white rounded-2xl shadow-md space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider opacity-80 font-bold">Assistant Leader</span>
            <h4 className="font-extrabold text-sm">Lorenzo Birao</h4>
          </div>

          <div className="p-4 bg-slate-800 text-white rounded-2xl shadow-md space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-300 font-bold">UI Designer</span>
            <h4 className="font-extrabold text-sm">Glenn Siaboc</h4>
          </div>

          <div className="p-4 bg-slate-800 text-white rounded-2xl shadow-md space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-300 font-bold">Programmer</span>
            <h4 className="font-extrabold text-sm">Reymark Napoles</h4>
          </div>

          <div className="p-4 bg-slate-800 text-white rounded-2xl shadow-md space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-indigo-300 font-bold">Developer</span>
            <h4 className="font-extrabold text-sm">John Merce Cano</h4>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold">Team Member</span>
            <h4 className="font-extrabold text-sm">Charles Christian Gallogo</h4>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold">Team Member</span>
            <h4 className="font-extrabold text-sm">Rey Hilardo</h4>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold">Team Member</span>
            <h4 className="font-extrabold text-sm">Georhyb Cais</h4>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold">Team Member</span>
            <h4 className="font-extrabold text-sm">John Carlo Llamos</h4>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold">Team Member</span>
            <h4 className="font-extrabold text-sm">James Roxas</h4>
          </div>

          <div className="p-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl space-y-1 sm:col-span-2 md:col-span-1">
            <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400 font-bold">Team Member</span>
            <h4 className="font-extrabold text-sm">Nathaniel Ponting</h4>
          </div>

        </div>
      </div>

      {/* PERMANENT RESEARCH DOCUMENTATION PICTURES */}
      <div className="space-y-4 pt-2">
        <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
          <ImageIcon size={20} className="text-indigo-500" />
          <span>Research Documentation Pictures</span>
        </h2>

        <p className="text-xs text-gray-500 dark:text-gray-400">
          Official high-quality documentation photos captured during system development, testing, implementation, and research deployment at CTU Pinamungajan:
        </p>

        {/* IMAGE GALLERY GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-2">
          {docImages.map((item, index) => (
            <div key={index} className="group relative bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md aspect-video">
              <img
                src={item.src}
                alt={item.caption}
                className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent p-3 text-white text-[11px] font-bold">
                {item.caption}
              </div>
            </div>
          ))}
        </div>
      </div>

     {/* INSTITUTION SECTION */}
      <div className="space-y-4 pt-2">
        <div className="p-6 bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl shadow-xl space-y-3 text-center sm:text-left flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-mono uppercase tracking-widest text-indigo-300 font-bold">
              Institutional Research Project Platform
            </span>
            <h3 className="text-xl font-black">
              CTU PINAMUNGAJAN CAMPUS
            </h3>
            <p className="text-xs sm:text-sm text-indigo-100/80">
              Created with dedication and teamwork for academic excellence and technological innovation.
            </p>
          </div>
          
          {/* CTU LOGO REPLACING THE PROFILE ICON */}
          <div className="bg-white/10 p-2 rounded-2xl backdrop-blur-xs border border-white/10 shrink-0 flex items-center justify-center">
            <img 
              src="/Ctulogo.jpg" 
              alt="CTU Logo" 
              className="w-14 h-14 object-contain rounded-xl" 
            />
          </div>
        </div>
      </div>

      {/* FOOTER ACTION */}
      <div className="flex justify-center pt-4 border-t border-gray-100 dark:border-gray-800">
        <button
          type="button"
          onClick={onBackToHome}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm transition shadow-lg cursor-pointer"
        >
          Return to Attendance Portal
        </button>
      </div>

    </div>
  );
}