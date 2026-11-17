import React, { useState } from 'react';
import { Info, Cpu, ShieldCheck, ArrowLeft, QrCode, Lock, CheckCircle2, School, Image as ImageIcon, Award, X } from 'lucide-react';

interface AboutUsProps {
  onBackToHome: () => void;
}

interface TeamMember {
  name: string;
  role: string;
  badgeColor: string;
  src?: string;
  bio?: string;
}

export default function AboutUs({ onBackToHome }: AboutUsProps) {
  // State para sa modal popup kon kinsang miyembro ang gi-klik
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  // Permanent research documentation pictures
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

  // 11-Member Research Team List with individual profile image paths (.jpg)
  const teamMembers: TeamMember[] = [
    { 
      name: 'Daniel Klint Dakay', 
      role: 'Team Leader', 
      badgeColor: 'bg-indigo-600 text-white', 
      src: '/Daniel.jpg', 
      bio: 'CTU Pinamungajan Research Team Leader' 
    },
    { 
      name: 'Lorenzo Birao', 
      role: 'Assistant Leader', 
      badgeColor: 'bg-indigo-500 text-white', 
      src: '/Lorenzo.jpg', 
      bio: 'Assistant Team Leader & Coordinator' 
    },
    { 
      name: 'Glenn Siaboc', 
      role: 'UI Designer', 
      badgeColor: 'bg-slate-800 text-white', 
      src: '/Gleen.jpg', 
      bio: 'User Interface & Visual Designer' 
    },
    { 
      name: 'Reymark Napoles', 
      role: 'Programmer', 
      badgeColor: 'bg-slate-800 text-white', 
      src: '/reymark.jpg', 
      bio: 'Lead System Programmer & Backend Developer' 
    },
    { 
      name: 'John Merce Cano', 
      role: 'Developer', 
      badgeColor: 'bg-slate-800 text-white', 
      src: '/johnmerce.jpg', 
      bio: 'Full-stack System Developer' 
    },
    { 
      name: 'Charles Christian Gallogo', 
      role: 'Team Member', 
      badgeColor: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700',
      src: '/charles.jpg',
      bio: 'Research Team Member' 
    },
    { 
      name: 'Rey Hilardo', 
      role: 'Team Member', 
      badgeColor: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700',
      src: '/rey.jpg',
      bio: 'Research Team Member' 
    },
    { 
      name: 'Georhyb Cais', 
      role: 'Team Member', 
      badgeColor: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700',
      src: '/georhyb.jpg',
      bio: 'Research Team Member' 
    },
    { 
      name: 'John Carlo Llamos', 
      role: 'Team Member', 
      badgeColor: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700',
      src: '/johncarlo.jpg',
      bio: 'Research Team Member' 
    },
    { 
      name: 'James Roxas', 
      role: 'Team Member', 
      badgeColor: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700',
      src: '/james.jpg',
      bio: 'Research Team Member' 
    },
    { 
      name: 'Nathaniel Ponting', 
      role: 'Team Member', 
      badgeColor: 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700',
      src: '/nathaniel.jpg',
      bio: 'Research Team Member' 
    },
  ];

  return (
    <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl border border-gray-100 dark:border-gray-800 p-6 sm:p-10 shadow-2xl space-y-8 my-6 animate-fadeIn relative">
      
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

      {/* TEAM MEMBERS DIRECTORY (CLICKABLE) */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-gray-900 dark:text-white flex items-center gap-2">
            <Award size={20} className="text-indigo-500" />
            <span>Our 11-Member Research Team</span>
          </h2>
          <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
            (I-klik ang ngalan para Makita ang Hulagway)
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {teamMembers.map((member, index) => (
            <div 
              key={index} 
              onClick={() => setSelectedMember(member)}
              className={`p-4 rounded-2xl shadow-md space-y-1 cursor-pointer hover:scale-[1.02] hover:shadow-lg transition group ${member.badgeColor}`}
            >
              <span className="text-[10px] uppercase font-mono tracking-wider opacity-80 font-bold block">
                {member.role}
              </span>
              <h4 className="font-extrabold text-sm group-hover:underline decoration-dotted">
                {member.name}
              </h4>
            </div>
          ))}
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
            <div 
              key={index} 
              onClick={() => setSelectedMember({ name: item.caption, role: 'Documentation Photo', badgeColor: '', src: item.src, bio: 'CTU Pinamungajan Research Project Documentation' })}
              className="group relative bg-gray-100 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-md aspect-video cursor-pointer"
            >
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

      {/* POPUP MODAL WHEN A TEAM MEMBER IS CLICKED */}
      {selectedMember && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-gray-900 border border-gray-800 rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden p-6 text-center space-y-4 relative">
            
            <button 
              onClick={() => setSelectedMember(null)}
              className="absolute top-4 right-4 text-gray-400 hover:text-white bg-gray-800 p-2 rounded-full transition cursor-pointer"
            >
              <X size={18} />
            </button>

            {/* Avatar / Photo */}
            <div className="w-32 h-32 mx-auto rounded-full bg-indigo-950 border-4 border-indigo-500 overflow-hidden shadow-xl flex items-center justify-center">
              {selectedMember.src ? (
                <img 
                  src={selectedMember.src} 
                  alt={selectedMember.name} 
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    // Fallback kon wala pa na-upload ang .jpg file
                    (e.target as HTMLElement).style.display = 'none';
                  }} 
                />
              ) : null}
              <span className="text-4xl font-black text-indigo-300 uppercase absolute -z-10">
                {selectedMember.name.charAt(0)}
              </span>
            </div>

            {/* Details */}
            <div className="space-y-1">
              <h3 className="text-xl font-bold text-white">{selectedMember.name}</h3>
              <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide">{selectedMember.role}</p>
              <p className="text-xs text-gray-400 pt-2">{selectedMember.bio || 'Member of the CTU Pinamungajan Research & Development Team.'}</p>
            </div>

            <button
              onClick={() => setSelectedMember(null)}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
}