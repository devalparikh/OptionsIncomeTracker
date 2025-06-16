"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"

const profileFormSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters").max(50, "Name must be less than 50 characters"),
  display_name: z.string().min(2, "Display name must be at least 2 characters").max(30, "Display name must be less than 30 characters"),
  timezone: z.string().min(1, "Timezone is required"),
})

type ProfileFormValues = z.infer<typeof profileFormSchema>

interface ProfileSettingsProps {
  profile: {
    id: string
    full_name: string | null
    display_name: string | null
    timezone: string | null
  } | null
}

export function ProfileSettings({ profile }: ProfileSettingsProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClientComponentClient()

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      full_name: profile?.full_name || "",
      display_name: profile?.display_name || "",
      timezone: profile?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
    },
  })

  async function onSubmit(data: ProfileFormValues) {
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          display_name: data.display_name,
          timezone: data.timezone,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile?.id)

      if (error) throw error

      toast.success("Profile updated successfully")
      router.refresh()
    } catch (error) {
      toast.error("Failed to update profile")
      console.error("Error updating profile:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your full name" {...field} />
              </FormControl>
              <FormDescription>
                Your full name as it appears on official documents
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="display_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Display Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter your display name" {...field} />
              </FormControl>
              <FormDescription>
                The name that will be displayed throughout the application
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="timezone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Timezone</FormLabel>
              <FormControl>
                <Input {...field} readOnly />
              </FormControl>
              <FormDescription>
                Your local timezone (automatically detected)
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Saving..." : "Save Changes"}
        </Button>
      </form>
    </Form>
  )
} 