import React, { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  BookOpen, 
  AlertTriangle,
  Brain,
  PieChart,
  Search,
  Activity,
  Scale,
  BarChart3,
  Shield,
  CheckCircle,
  XCircle,
  Lightbulb,
  ArrowRight,
  Info,
  Users,
  Database,
  Code,
  Eye,
  Filter,
  Target,
  Zap,
  Award,
  Layers,
  Monitor,
  FileText,
  Cpu,
  Globe,
  Heart,
  Settings,
  Clock,
  Flag,
  Gauge,
  Key,
  Map,
  Network,
  Scan,
  Server,
  Share2,
  Signal,
  Terminal,
  Triangle,
  Video,
  Wifi,
  Workflow,
  Grid,
  Tag,
  Briefcase, 
  GraduationCap,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  ChevronDown,
  Maximize2,
  Minimize2,
  CreditCard,
  MessageSquare
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  PieChart as RePieChart,
  Pie,
  Cell,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from 'recharts';
import slidesData from '../data/slidesData.json';

const iconMap = {
  'brain': Brain,
  'alert-triangle': AlertTriangle,
  'pie-chart': PieChart,
  'search': Search,
  'activity': Activity,
  'scale': Scale,
  'bar-chart': BarChart3,
  'shield': Shield,
  'check-circle': CheckCircle,
  'lightbulb': Lightbulb,
  'users': Users,
  'database': Database,
  'code': Code,
  'eye': Eye,
  'filter': Filter,
  'target': Target,
  'zap': Zap,
  'award': Award,
  'layers': Layers,
  'monitor': Monitor,
  'file-text': FileText,
  'cpu': Cpu,
  'globe': Globe,
  'heart': Heart,
  'settings': Settings,
  'clock': Clock,
  'flag': Flag,
  'gauge': Gauge,
  'key': Key,
  'map': Map,
  'network': Network,
  'scan': Scan,
  'server': Server,
  'share-2': Share2,
  'signal': Signal,
  'terminal': Terminal,
  'triangle': Triangle,
  'video': Video,
  'wifi': Wifi,
  'workflow': Workflow
};

const colorSchemes = {
  blue: {
    bg: 'bg-gradient-to-br from-blue-50 to-indigo-50',
    border: 'border-blue-200',
    text: 'text-blue-900',
    accent: 'bg-blue-600',
    light: 'bg-blue-100',
    chart: '#3b82f6'
  },
  red: {
    bg: 'bg-gradient-to-br from-red-50 to-rose-50',
    border: 'border-red-200',
    text: 'text-red-900',
    accent: 'bg-red-600',
    light: 'bg-red-100',
    chart: '#ef4444'
  },
  purple: {
    bg: 'bg-gradient-to-br from-purple-50 to-violet-50',
    border: 'border-purple-200',
    text: 'text-purple-900',
    accent: 'bg-purple-600',
    light: 'bg-purple-100',
    chart: '#8b5cf6'
  },
  orange: {
    bg: 'bg-gradient-to-br from-orange-50 to-amber-50',
    border: 'border-orange-200',
    text: 'text-orange-900',
    accent: 'bg-orange-600',
    light: 'bg-orange-100',
    chart: '#f97316'
  },
  green: {
    bg: 'bg-gradient-to-br from-green-50 to-emerald-50',
    border: 'border-green-200',
    text: 'text-green-900',
    accent: 'bg-green-600',
    light: 'bg-green-100',
    chart: '#10b981'
  },
  teal: {
    bg: 'bg-gradient-to-br from-teal-50 to-cyan-50',
    border: 'border-teal-200',
    text: 'text-teal-900',
    accent: 'bg-teal-600',
    light: 'bg-teal-100',
    chart: '#14b8a6'
  },
  yellow: {
    bg: 'bg-gradient-to-br from-yellow-50 to-amber-50',
    border: 'border-yellow-200',
    text: 'text-yellow-900',
    accent: 'bg-yellow-600',
    light: 'bg-yellow-100',
    chart: '#f59e0b'
  }
};

const Illustration = ({ type, color }) => {
  const scheme = colorSchemes[color] || colorSchemes.blue;
  
  switch (type) {
    case 'ai-brain':
      return (
        <div className="relative w-56 h-56 mx-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-blue-400/30 to-purple-400/30 rounded-full animate-pulse" />
          <div className="absolute inset-4 bg-gradient-to-br from-blue-500/40 to-purple-500/40 rounded-full" />
          <div className="absolute inset-8 bg-white rounded-full flex items-center justify-center shadow-inner">
            <Brain className="w-24 h-24 text-blue-600" />
          </div>
          <div className="absolute top-0 right-4 animate-bounce">
            <Zap className="w-8 h-8 text-yellow-500" />
          </div>
          <div className="absolute bottom-4 left-0">
            <Activity className="w-8 h-8 text-green-500" />
          </div>
          <div className="absolute top-1/2 -right-2">
            <Sparkles className="w-6 h-6 text-purple-500" />
          </div>
        </div>
      );
    
    case 'bias-warning':
      return (
        <div className="relative w-48 h-48 mx-auto">
          <div className="absolute inset-0 bg-red-100 rounded-full animate-ping opacity-20" />
          <div className="absolute inset-4 bg-gradient-to-br from-red-50 to-rose-50 rounded-full flex items-center justify-center border-4 border-red-200 shadow-lg">
            <AlertTriangle className="w-20 h-20 text-red-500" />
          </div>
          <div className="absolute -top-2 -right-2">
            <div className="bg-gradient-to-br from-red-500 to-red-600 text-white text-sm font-bold px-3 py-1 rounded-full shadow-lg">!</div>
          </div>
        </div>
      );
    
    case 'types-chart':
      return (
        <div className="grid grid-cols-2 gap-3 p-2">
          {[
            { icon: Database, label: 'Data', color: 'blue', desc: '45%' },
            { icon: Code, label: 'Algorithm', color: 'purple', desc: '25%' },
            { icon: Users, label: 'User', color: 'orange', desc: '15%' },
            { icon: Eye, label: 'Evaluation', color: 'green', desc: '10%' },
            { icon: Server, label: 'Deployment', color: 'red', desc: '5%' }
          ].map((item, idx) => (
            <div key={idx} className={`p-4 rounded-xl bg-${item.color}-50 border-2 border-${item.color}-200 flex flex-col items-center hover:scale-105 transition-transform cursor-pointer shadow-sm`}>
              <item.icon className={`w-10 h-10 text-${item.color}-500 mb-2`} />
              <span className={`text-sm font-bold text-${item.color}-700`}>{item.label}</span>
              <span className={`text-xs text-${item.color}-600`}>{item.desc}</span>
            </div>
          ))}
        </div>
      );
    
    case 'sources-network':
      return (
        <div className="relative w-full h-56">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-24 h-24 bg-gradient-to-br from-red-100 to-rose-100 rounded-full flex items-center justify-center border-4 border-red-300 shadow-lg">
              <AlertTriangle className="w-12 h-12 text-red-600" />
            </div>
          </div>
          {[
            { icon: Clock, label: 'Historical', angle: 0, color: 'blue' },
            { icon: Users, label: 'Sampling', angle: 72, color: 'purple' },
            { icon: Filter, label: 'Features', angle: 144, color: 'orange' },
            { icon: Tag, label: 'Labels', angle: 216, color: 'green' },
            { icon: Settings, label: 'Design', angle: 288, color: 'red' }
          ].map((item, idx) => {
            const angle = (item.angle * Math.PI) / 180;
            const x = Math.cos(angle) * 80;
            const y = Math.sin(angle) * 80;
            return (
              <div
                key={idx}
                className="absolute flex flex-col items-center"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div className={`w-14 h-14 bg-${item.color}-100 rounded-full flex items-center justify-center border-2 border-${item.color}-300 shadow-md hover:scale-110 transition-transform cursor-pointer`}>
                  <item.icon className={`w-7 h-7 text-${item.color}-600`} />
                </div>
                <span className="text-xs font-medium text-gray-700 mt-1 whitespace-nowrap bg-white/80 px-2 py-0.5 rounded-full">{item.label}</span>
              </div>
            );
          })}
        </div>
      );
    
    case 'impact-areas':
      return (
        <div className="flex flex-wrap justify-center gap-3 p-2">
          {[
            { icon: Briefcase, label: 'Hiring', color: 'blue', count: 85 },
            { icon: Scale, label: 'Justice', color: 'red', count: 120 },
            { icon: Heart, label: 'Health', color: 'green', count: 65 },
            { icon: CreditCard, label: 'Finance', color: 'purple', count: 95 },
            { icon: GraduationCap, label: 'Education', color: 'orange', count: 45 }
          ].map((item, idx) => (
            <div key={idx} className="flex flex-col items-center p-4 bg-white rounded-xl shadow-md border border-gray-100 hover:shadow-lg hover:-translate-y-1 transition-all cursor-pointer">
              <div className={`w-14 h-14 rounded-full bg-${item.color}-100 flex items-center justify-center mb-2`}>
                <item.icon className={`w-7 h-7 text-${item.color}-600`} />
              </div>
              <span className="text-sm font-bold text-gray-800">{item.label}</span>
              <span className={`text-lg font-bold text-${item.color}-600`}>{item.count}</span>
            </div>
          ))}
        </div>
      );
    
    case 'bbq-logo':
      return (
        <div className="flex items-center justify-center gap-8 py-4">
          <div className="relative">
            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-xl">
              <Scale className="w-16 h-16 text-white" />
            </div>
            <div className="absolute -top-3 -right-3 bg-yellow-400 text-yellow-900 text-sm font-bold px-3 py-1 rounded-full shadow-lg">
              BBQ
            </div>
          </div>
          <div className="flex flex-col gap-3">
            {[
              { icon: CheckCircle, text: '11 Categories', color: 'blue' },
              { icon: CheckCircle, text: '58,492 Examples', color: 'green' },
              { icon: CheckCircle, text: '9 Demographics', color: 'purple' }
            ].map((item, idx) => (
              <div key={idx} className="flex items-center gap-3 bg-white/50 backdrop-blur-sm px-4 py-2 rounded-lg">
                <item.icon className={`w-5 h-5 text-${item.color}-500`} />
                <span className="text-sm font-semibold text-gray-700">{item.text}</span>
              </div>
            ))}
          </div>
        </div>
      );
    
    case 'categories-wheel':
      return (
        <div className="relative w-72 h-72 mx-auto">
          {[
            { label: 'Race×Gender', color: '#3b82f6', size: 35 },
            { label: 'Race×SES', color: '#8b5cf6', size: 25 },
            { label: 'SES', color: '#f59e0b', size: 15 },
            { label: 'Gender', color: '#10b981', size: 12 },
            { label: 'Age', color: '#ef4444', size: 8 },
            { label: 'Race', color: '#06b6d4', size: 15 }
          ].map((item, idx) => {
            const angle = (idx * 60 * Math.PI) / 180;
            const radius = 100;
            const x = Math.cos(angle) * radius;
            const y = Math.sin(angle) * radius;
            return (
              <div
                key={idx}
                className="absolute flex flex-col items-center"
                style={{
                  left: `calc(50% + ${x}px)`,
                  top: `calc(50% + ${y}px)`,
                  transform: 'translate(-50%, -50%)'
                }}
              >
                <div 
                  className="rounded-full flex items-center justify-center text-white text-xs font-bold shadow-lg hover:scale-110 transition-transform cursor-pointer"
                  style={{ 
                    width: `${item.size * 1.8}px`, 
                    height: `${item.size * 1.8}px`,
                    backgroundColor: item.color 
                  }}
                >
                  {item.size}%
                </div>
                <span className="text-xs font-medium text-gray-600 mt-1 whitespace-nowrap bg-white/80 px-2 py-0.5 rounded-full">{item.label}</span>
              </div>
            );
          })}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center border-4 border-gray-300 shadow-inner">
              <PieChart className="w-10 h-10 text-gray-600" />
            </div>
          </div>
        </div>
      );
    
    case 'mitigation-steps':
      return (
        <div className="flex flex-col gap-4 py-4 max-w-md mx-auto">
          {[
            { step: 1, icon: Database, label: 'Preprocess', color: 'blue', desc: 'Clean & Balance' },
            { step: 2, icon: Code, label: 'Algorithm', color: 'purple', desc: 'Fair Training' },
            { step: 3, icon: Settings, label: 'Post-process', color: 'orange', desc: 'Adjust Outputs' },
            { step: 4, icon: Monitor, label: 'Monitor', color: 'green', desc: 'Track Performance' }
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-4 group">
              <div className={`w-12 h-12 rounded-full bg-${item.color}-500 text-white flex items-center justify-center font-bold text-lg shadow-lg group-hover:scale-110 transition-transform`}>
                {item.step}
              </div>
              <div className={`flex-1 p-4 bg-${item.color}-50 rounded-xl border-l-4 border-${item.color}-500 shadow-sm group-hover:shadow-md transition-shadow`}>
                <div className="flex items-center gap-2">
                  <item.icon className={`w-5 h-5 text-${item.color}-600`} />
                  <span className={`font-bold text-${item.color}-800`}>{item.label}</span>
                </div>
                <span className={`text-sm text-${item.color}-600`}>{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      );
    
    case 'fairness-comparison':
      return (
        <div className="flex items-center justify-center gap-12 py-6">
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-red-100 to-rose-100 border-4 border-red-300 flex items-center justify-center mb-3 shadow-lg">
              <XCircle className="w-14 h-14 text-red-500" />
            </div>
            <span className="text-lg font-bold text-red-700">Before</span>
            <div className="text-sm text-gray-500 mt-1">45% Fair</div>
          </div>
          <div className="flex flex-col items-center">
            <ArrowRight className="w-10 h-10 text-gray-400" />
            <span className="text-xs text-gray-400 mt-2">Improvement</span>
          </div>
          <div className="text-center">
            <div className="w-28 h-28 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 border-4 border-green-300 flex items-center justify-center mb-3 shadow-lg">
              <CheckCircle className="w-14 h-14 text-green-500" />
            </div>
            <span className="text-lg font-bold text-green-700">After</span>
            <div className="text-sm text-gray-500 mt-1">85% Fair</div>
          </div>
        </div>
      );
    
    case 'best-practices':
      return (
        <div className="grid grid-cols-2 gap-4 p-2">
          {[
            { icon: Search, label: 'Audit', desc: 'Regular checks' },
            { icon: Users, label: 'Diversify', desc: 'Multiple perspectives' },
            { icon: FileText, label: 'Document', desc: 'Transparent sources' },
            { icon: Target, label: 'Metrics', desc: 'Clear fairness goals' },
            { icon: Eye, label: 'Oversight', desc: 'Human review' },
            { icon: MessageSquare, label: 'Feedback', desc: 'Community input' }
          ].map((item, idx) => (
            <div key={idx} className="flex items-start gap-3 p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
                <item.icon className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <span className="font-bold text-gray-800 block">{item.label}</span>
                <span className="text-xs text-gray-500">{item.desc}</span>
              </div>
            </div>
          ))}
        </div>
      );
    
    default:
      return null;
  }
};

const SlideContent = ({ slide }) => {
  const Icon = iconMap[slide.icon] || BookOpen;
  const scheme = colorSchemes[slide.color] || colorSchemes.blue;

  const renderChart = () => {
    if (!slide.chartData) return null;

    switch (slide.chartType) {
      case 'bar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={slide.chartData.labels.map((label, i) => ({
              name: label,
              value: slide.chartData.datasets[0].data[i]
            }))}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="name" tick={{fontSize: 11}} stroke="#6b7280" />
              <YAxis stroke="#6b7280" />
              <Tooltip 
                contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
              />
              <Bar dataKey="value" fill={scheme.chart} radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'horizontalBar':
        return (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart 
              data={slide.chartData.labels.map((label, i) => ({
                name: label,
                value: slide.chartData.datasets[0].data[i]
              }))}
              layout="vertical"
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis type="number" stroke="#6b7280" />
              <YAxis dataKey="name" type="category" width={90} tick={{fontSize: 11}} stroke="#6b7280" />
              <Tooltip 
                contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
              />
              <Bar dataKey="value" fill={scheme.chart} radius={[0, 8, 8, 0]} />
            </BarChart>
          </ResponsiveContainer>
        );

      case 'doughnut':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <RePieChart>
              <Pie
                data={slide.chartData.labels.map((label, i) => ({
                  name: label,
                  value: slide.chartData.datasets[0].data[i]
                }))}
                cx="50%"
                cy="50%"
                innerRadius={70}
                outerRadius={110}
                paddingAngle={3}
                dataKey="value"
                label={({name, percent}) => `${(percent * 100).toFixed(0)}%`}
              >
                {slide.chartData.datasets[0].data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={slide.chartData.datasets[0].backgroundColor[index]} />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
              />
            </RePieChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={320}>
            <RadarChart cx="50%" cy="50%" outerRadius="80%" data={
              slide.chartData.labels.map((label, i) => ({
                subject: label,
                before: slide.chartData.datasets[0].data[i],
                after: slide.chartData.datasets[1].data[i]
              }))
            }>
              <PolarGrid stroke="#e5e7eb" />
              <PolarAngleAxis dataKey="subject" tick={{fontSize: 10}} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} stroke="#6b7280" />
              <Radar
                name="Before Mitigation"
                dataKey="before"
                stroke="#ef4444"
                fill="#ef4444"
                fillOpacity={0.2}
              />
              <Radar
                name="After Mitigation"
                dataKey="after"
                stroke="#10b981"
                fill="#10b981"
                fillOpacity={0.2}
              />
              <Legend />
              <Tooltip 
                contentStyle={{backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
              />
            </RadarChart>
          </ResponsiveContainer>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Slide Header */}
      <div className={`p-6 ${scheme.bg} border-b-2 ${scheme.border}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`p-3 bg-white rounded-xl shadow-md`}>
              <Icon className={`w-8 h-8 ${scheme.text}`} />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Slide {slide.id}</span>
              </div>
              <h2 className={`text-2xl font-bold ${scheme.text}`}>{slide.title}</h2>
              {slide.subtitle && (
                <p className={`mt-1 text-lg opacity-80 ${scheme.text}`}>{slide.subtitle}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slide Body */}
      <div className="flex-1 p-6 overflow-y-auto bg-white">
        {slide.type === 'title' && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Illustration type="ai-brain" color={slide.color} />
            <p className="text-xl text-gray-600 max-w-2xl mt-8 leading-relaxed">{slide.content}</p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <div className="flex items-center gap-2 px-5 py-3 bg-blue-50 rounded-full border border-blue-200 shadow-sm hover:shadow-md transition-shadow">
                <Scale className="w-5 h-5 text-blue-600" />
                <span className="text-blue-800 font-semibold">14 Slides</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-purple-50 rounded-full border border-purple-200 shadow-sm hover:shadow-md transition-shadow">
                <BarChart3 className="w-5 h-5 text-purple-600" />
                <span className="text-purple-800 font-semibold">Interactive Charts</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-green-50 rounded-full border border-green-200 shadow-sm hover:shadow-md transition-shadow">
                <Lightbulb className="w-5 h-5 text-green-600" />
                <span className="text-green-800 font-semibold">Visual Learning</span>
              </div>
              <div className="flex items-center gap-2 px-5 py-3 bg-orange-50 rounded-full border border-orange-200 shadow-sm hover:shadow-md transition-shadow">
                <Users className="w-5 h-5 text-orange-600" />
                <span className="text-orange-800 font-semibold">Real-World Cases</span>
              </div>
            </div>
          </div>
        )}

        {slide.type === 'content' && (
          <div className="space-y-6">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0">
                <Illustration type={slide.illustration || 'bias-warning'} color={slide.color} />
              </div>
              <div className="flex-1">
                <p className="text-lg text-gray-700 leading-relaxed">{slide.content}</p>
              </div>
            </div>
            
            {slide.bulletPoints && (
              <div className="bg-gray-50 rounded-2xl p-6 border border-gray-200">
                <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  Key Points
                </h3>
                <ul className="space-y-3">
                  {slide.bulletPoints.map((point, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0`} style={{backgroundColor: scheme.chart}} />
                      <span className="text-gray-700">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quote Section */}
            {slide.quote && (
              <div className="mt-6 p-6 bg-gradient-to-r from-gray-50 to-gray-100 rounded-2xl border-l-4 border-gray-400">
                <div className="flex items-start gap-4">
                  <div className="text-4xl text-gray-400 font-serif leading-none">"</div>
                  <div>
                    <p className="text-lg text-gray-700 italic">{slide.quote.text}</p>
                    <p className="mt-2 text-sm text-gray-500 font-medium">— {slide.quote.author}</p>
                  </div>
                </div>
              </div>
            )}

            {slide.sections && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {slide.sections.map((section, index) => (
                  <div key={index} className="p-5 bg-white rounded-xl border-2 border-gray-100 hover:border-blue-200 transition-all duration-300 shadow-sm hover:shadow-md group">
                    <div className="flex items-center gap-2 mb-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110`} style={{backgroundColor: `${scheme.chart}20`}}>
                        <span className="font-bold" style={{color: scheme.chart}}>{index + 1}</span>
                      </div>
                      <h3 className="font-bold text-gray-800">{section.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 leading-relaxed">{section.content}</p>
                  </div>
                ))}
              </div>
            )}

            {slide.stats && (
              <div className="grid grid-cols-3 gap-4">
                {slide.stats.map((stat, index) => (
                  <div key={index} className="text-center p-6 bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                    <div className="text-4xl font-bold mb-2" style={{color: scheme.chart}}>{stat.value}</div>
                    <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
                  </div>
                ))}
              </div>
            )}

            {slide.callToAction && (
              <div className="mt-8 text-center">
                <a 
                  href={slide.callToAction.link}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all shadow-lg hover:shadow-xl hover:scale-105 transform duration-200"
                >
                  {slide.callToAction.text}
                  <ArrowRight className="w-5 h-5" />
                </a>
              </div>
            )}
          </div>
        )}

        {slide.type === 'chart' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 mb-4">
              <div className="flex-shrink-0">
                {slide.chartType === 'bar' && <Illustration type="types-chart" color={slide.color} />}
                {slide.chartType === 'horizontalBar' && <Illustration type="impact-areas" color={slide.color} />}
                {slide.chartType === 'doughnut' && <Illustration type="categories-wheel" color={slide.color} />}
                {slide.chartType === 'radar' && <Illustration type="fairness-comparison" color={slide.color} />}
              </div>
              <p className="text-gray-700 flex-1">{slide.content}</p>
            </div>
            <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
              {renderChart()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const EducationalSlides = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showOverview, setShowOverview] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);

  const nextSlide = () => {
    if (currentSlide < slidesData.slides.length - 1) {
      setCurrentSlide(currentSlide + 1);
    } else {
      setIsAutoPlay(false);
    }
  };

  const prevSlide = () => {
    if (currentSlide > 0) {
      setCurrentSlide(currentSlide - 1);
    }
  };

  const goToSlide = (index) => {
    setCurrentSlide(index);
    setShowOverview(false);
  };

  const resetSlides = () => {
    setCurrentSlide(0);
    setIsAutoPlay(false);
  };

  // Auto-play functionality
  useEffect(() => {
    let interval;
    if (isAutoPlay) {
      interval = setInterval(() => {
        nextSlide();
      }, 5000);
    }
    return () => clearInterval(interval);
  }, [isAutoPlay, currentSlide]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        nextSlide();
      } else if (e.key === 'ArrowLeft') {
        prevSlide();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide]);

  const progress = ((currentSlide + 1) / slidesData.slides.length) * 100;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-br from-blue-500 via-purple-500 to-indigo-600 rounded-xl shadow-lg">
                <BookOpen className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{slidesData.title}</h1>
                <p className="text-gray-500 text-sm">Interactive Learning Module • 14 Comprehensive Slides</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                <span className="text-sm font-medium text-blue-700">{currentSlide + 1} / {slidesData.slides.length}</span>
              </div>
              <button
                onClick={() => setIsAutoPlay(!isAutoPlay)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                  isAutoPlay 
                    ? 'bg-green-100 text-green-700 border border-green-300' 
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {isAutoPlay ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                {isAutoPlay ? 'Pause' : 'Auto-play'}
              </button>
              <button
                onClick={resetSlides}
                className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Reset
              </button>
              <button
                onClick={() => setShowOverview(!showOverview)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
              >
                <Grid className="w-4 h-4" />
                {showOverview ? 'Hide' : 'Overview'}
              </button>
            </div>
          </div>
        </div>

        {/* Overview Panel */}
        {showOverview && (
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 border border-gray-100 animate-in fade-in slide-in-from-top-4 duration-300">
            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              Slide Overview
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {slidesData.slides.map((slide, index) => {
                const Icon = iconMap[slide.icon] || BookOpen;
                const isActive = index === currentSlide;
                return (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(index)}
                    className={`p-3 rounded-xl text-left transition-all duration-200 ${
                      isActive 
                        ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg scale-105' 
                        : 'bg-gray-50 border-2 border-gray-100 hover:border-blue-300 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-gray-500'}`} />
                      <span className={`text-xs font-medium ${isActive ? 'text-blue-100' : 'text-gray-400'}`}>
                        {index + 1}
                      </span>
                    </div>
                    <p className={`text-xs font-medium line-clamp-2 ${isActive ? 'text-white' : 'text-gray-700'}`}>
                      {slide.title}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Main Slide Area */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100" style={{ minHeight: '650px' }}>
          <SlideContent slide={slidesData.slides[currentSlide]} />
        </div>

        {/* Navigation Controls */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mt-6 border border-gray-100">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <button
              onClick={prevSlide}
              disabled={currentSlide === 0}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                currentSlide === 0 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-white border-2 border-gray-200 text-gray-700 hover:border-blue-500 hover:text-blue-600 shadow-sm hover:shadow-md'
              }`}
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>

            <div className="flex flex-col items-center gap-3 order-first md:order-none">
              <span className="text-gray-600 font-medium">
                Slide <span className="font-bold text-gray-800 text-lg">{currentSlide + 1}</span> of {slidesData.slides.length}
              </span>
              
              {/* Progress Bar */}
              <div className="w-64 md:w-80 h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-indigo-600 transition-all duration-500 ease-out"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            <button
              onClick={nextSlide}
              disabled={currentSlide === slidesData.slides.length - 1}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all ${
                currentSlide === slidesData.slides.length - 1 
                  ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-blue-600 to-blue-700 text-white hover:from-blue-700 hover:to-blue-800 shadow-lg hover:shadow-xl'
              }`}
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Navigation Dots */}
          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {slidesData.slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all duration-300 ${
                  index === currentSlide 
                    ? 'w-8 h-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full' 
                    : 'w-3 h-3 bg-gray-300 hover:bg-gray-400 rounded-full'
                }`}
                title={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>

        {/* Learning Tips */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-2xl p-6 mt-6 border border-blue-100 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-white rounded-xl shadow-sm">
              <Info className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">Learning Tips</h3>
              <p className="text-gray-600">
                Use <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">←</kbd> <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">→</kbd> arrow keys or <kbd className="px-2 py-1 bg-gray-100 rounded text-sm font-mono text-gray-700">Space</kbd> to navigate. Each slide contains visual illustrations and interactive charts to help you understand AI bias concepts.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EducationalSlides;
