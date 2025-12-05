import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// If your Prisma file is located elsewhere, you can change the path
import { PrismaClient } from "@/app/generated/prisma/client";

import { emailOTP } from "better-auth/plugins";
import { stripe } from "@better-auth/stripe";
import Stripe from "stripe";
import { Resend } from "resend";
import VerifyEmail from "@/components/auth/verification-email";

const stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-11-17.clover",
});

const resend = new Resend(process.env.RESEND_API_KEY!);

const prisma = new PrismaClient();
export const auth = betterAuth({
  secret: process.env.BETTER_AUTH_SECRET!,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  socialProviders: {
    google: {
      prompt: "select_account",
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    },
  },
  plugins: [
    emailOTP({
      storeOTP: "encrypted",
      overrideDefaultEmailVerification: true,
      disableSignUp: false,
      async sendVerificationOTP({ email, otp, type }) {
        try {
          await resend.emails.send({
            from: "onboarding@resend.dev",
            to: email,
            subject: `Email Verification Code`,
            react: VerifyEmail({ otp }),
            text: `VERIFY YOUR EMAIL ADDRESS\nThanks for starting the verification process. We want to make sure it is really you. Please enter the following verification code when prompted. If you do not want to create an account, you can ignore this message.\n
            Verification code\n${otp}\n(This code is valid for 10 minutes)\n
            ----------------------------------------\n
            Please do not share this code with anyone. We will never ask
            you for this code.`,
          });
        } catch (error) {
          console.error("Failed to send OTP email:", error);
        }
        return;
      },
      otpLength: 6,
      allowedAttempts: 5,
      expiresIn: 600,
    }),
    stripe({
      stripeClient,
      stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      createCustomerOnSignUp: true,
      subscription: {
        enabled: true,
        plans: [
          {
            name: "plus",
            priceId: process.env.STRIPE_PRICE_ID_PLUS!,
            limits: {
              projects: 50,
              storage: 100,
            },
          },
          {
            name: "pro",
            priceId: process.env.STRIPE_PRICE_ID_PRO!,
            limits: {
              projects: 100,
              storage: 150,
            },
          },
          {
            name: "premium",
            priceId: process.env.STRIPE_PRICE_ID_PREMIUM!,
            limits: {
              projects: 150,
              storage: 200,
            },
          },
        ],
      },
    }),
  ],
});
