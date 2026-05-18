'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, User, BookOpen, LogOut } from 'lucide-react'
import { useAuth } from './AuthProvider'

interface ProfileSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export default function ProfileSidebar({ isOpen, onClose }: ProfileSidebarProps) {
  const { user, logout } = useAuth()

  if (!user) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black bg-opacity-20 backdrop-blur-sm z-40"
          />

          {/* Sidebar */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 w-full sm:w-96 glass dark:glass-dark z-50 p-6 sm:p-8 overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-xl sm:text-2xl font-semibold">Profile</h2>
              <motion.button
                onClick={onClose}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className="p-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </motion.button>
            </div>

            <div className="space-y-6">
              {/* Profile Avatar */}
              <div className="flex justify-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-apple-blue to-blue-600 flex items-center justify-center">
                  <User className="w-10 h-10 sm:w-12 sm:h-12 text-white" />
                </div>
              </div>

              {/* Student Info */}
              <div className="text-center">
                <h3 className="text-lg sm:text-xl font-semibold mb-1">{user.name}</h3>
                <p className="text-apple-dark-gray text-xs sm:text-sm">ID: {user.studentId}</p>
                <p className="text-apple-dark-gray text-xs sm:text-sm mt-1">{user.class}</p>
              </div>

              {/* Enrolled Subjects */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center gap-2 mb-4">
                  <BookOpen className="w-5 h-5 text-apple-blue" />
                  <h4 className="font-semibold">Enrolled Subjects</h4>
                </div>
                <div className="space-y-2">
                  {(Array.isArray(user.subjects) ? user.subjects : []).map((subject, index) => (
                    <motion.div
                      key={subject}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="p-3 rounded-apple bg-apple-gray dark:bg-gray-800"
                    >
                      <p className="text-sm">{subject}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Logout Button */}
              <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                <motion.button
                  onClick={logout}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3 px-4 rounded-apple bg-red-500 hover:bg-red-600 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Logout
                </motion.button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
