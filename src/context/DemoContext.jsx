// Holds sample people and activity in the browser so every page can share it.
// Changes stay in memory and are deliberately cleared when the page reloads.
import { createContext, useContext, useState } from 'react'
import {
  demoComments,
  demoConversations,
  demoFollows,
  demoLikedPostIds,
  demoMessages,
  demoNotifications,
  demoPosts,
  demoProfiles,
  demoProjects,
  demoSavedProjects,
} from '../lib/demoData'

const DemoContext = createContext(null)

export function DemoProvider({ children }) {
  // Each list below is a changeable copy of its starting sample data.
  const [profiles, setProfiles] = useState(demoProfiles)
  const [projects, setProjects] = useState(demoProjects)
  const [posts, setPosts] = useState(demoPosts)
  const [comments, setComments] = useState(demoComments)
  const [follows, setFollows] = useState(demoFollows)
  const [savedProjects, setSavedProjects] = useState(demoSavedProjects)
  const [likedPostIds, setLikedPostIds] = useState(demoLikedPostIds)
  const [notifications, setNotifications] = useState(demoNotifications)
  const [conversations, setConversations] = useState(demoConversations)
  const [messages, setMessages] = useState(demoMessages)
  const [reports, setReports] = useState([])

  // Pages use these lists like shared storage while running without a backend.
  return (
    <DemoContext.Provider value={{
      profiles, setProfiles,
      projects, setProjects,
      posts, setPosts,
      comments, setComments,
      follows, setFollows,
      savedProjects, setSavedProjects,
      likedPostIds, setLikedPostIds,
      notifications, setNotifications,
      conversations, setConversations,
      messages, setMessages,
      reports, setReports,
    }}>
      {children}
    </DemoContext.Provider>
  )
}

export const useDemoData = () => useContext(DemoContext)
